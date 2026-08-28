import json
import uuid

from fastapi import FastAPI, Header, HTTPException, Response

from common import TABLE_NAME, ensure_resources

app = FastAPI(title="ATL Open Service Broker", version="1.0.0")


def require_osb_version(version: str | None):
    if not version:
        raise HTTPException(status_code=412, detail="X-Broker-API-Version is required")


@app.get("/healthz")
def healthz():
    ensure_resources()
    return {"status": "ok"}


@app.get("/v2/catalog")
def catalog(x_broker_api_version: str | None = Header(default=None)):
    require_osb_version(x_broker_api_version)
    return {
        "services": [{
            "id": "edge-routing",
            "name": "edge-routing",
            "description": "Teaching replica of an internal edge routing service",
            "bindable": False,
            "plan_updateable": True,
            "plans": [{"id": "shared", "name": "shared", "description": "Shared Envoy fleet"}],
        }]
    }


@app.put("/v2/service_instances/{instance_id}", status_code=202)
def provision(instance_id: str, body: dict, response: Response, x_broker_api_version: str | None = Header(default=None)):
    require_osb_version(x_broker_api_version)
    sqs, ddb, queue_url, _ = ensure_resources()
    current = ddb.get_item(TableName=TABLE_NAME, Key={"instance_id": {"S": instance_id}}).get("Item")
    plan_id = body.get("plan_id", "shared")
    if current:
        if current.get("plan_id", {}).get("S") != plan_id:
            raise HTTPException(status_code=409, detail="instance already exists with another plan")
        response.status_code = 200
        return {"operation": current["operation"]["S"]}

    operation = str(uuid.uuid4())
    ddb.put_item(TableName=TABLE_NAME, Item={
        "instance_id": {"S": instance_id},
        "plan_id": {"S": plan_id},
        "operation": {"S": operation},
        "state": {"S": "in progress"},
        "description": {"S": "request accepted by broker"},
    })
    sqs.send_message(QueueUrl=queue_url, MessageBody=json.dumps({
        "action": "provision",
        "instance_id": instance_id,
        "operation": operation,
        "parameters": body.get("parameters", {}),
    }))
    return {"operation": operation}


@app.get("/v2/service_instances/{instance_id}/last_operation")
def last_operation(instance_id: str, x_broker_api_version: str | None = Header(default=None)):
    require_osb_version(x_broker_api_version)
    _, ddb, _, _ = ensure_resources()
    item = ddb.get_item(TableName=TABLE_NAME, Key={"instance_id": {"S": instance_id}}).get("Item")
    if not item:
        raise HTTPException(status_code=410, detail="instance does not exist")
    return {"state": item["state"]["S"], "description": item["description"]["S"]}


@app.delete("/v2/service_instances/{instance_id}", status_code=202)
def deprovision(instance_id: str, x_broker_api_version: str | None = Header(default=None)):
    require_osb_version(x_broker_api_version)
    sqs, ddb, queue_url, _ = ensure_resources()
    operation = str(uuid.uuid4())
    ddb.update_item(
        TableName=TABLE_NAME,
        Key={"instance_id": {"S": instance_id}},
        UpdateExpression="SET #state = :state, description = :description, operation = :operation",
        ExpressionAttributeNames={"#state": "state"},
        ExpressionAttributeValues={
            ":state": {"S": "in progress"},
            ":description": {"S": "deprovision queued"},
            ":operation": {"S": operation},
        },
    )
    sqs.send_message(QueueUrl=queue_url, MessageBody=json.dumps({"action": "deprovision", "instance_id": instance_id, "operation": operation}))
    return {"operation": operation}
