import json
import time

from common import TABLE_NAME, ensure_resources


def set_state(ddb, instance_id: str, state: str, description: str):
    ddb.update_item(
        TableName=TABLE_NAME,
        Key={"instance_id": {"S": instance_id}},
        UpdateExpression="SET #state = :state, description = :description",
        ExpressionAttributeNames={"#state": "state"},
        ExpressionAttributeValues={":state": {"S": state}, ":description": {"S": description}},
    )


def run():
    sqs, ddb, queue_url, _ = ensure_resources()
    print(f"worker polling {queue_url}", flush=True)
    while True:
        result = sqs.receive_message(QueueUrl=queue_url, MaxNumberOfMessages=1, WaitTimeSeconds=2, AttributeNames=["ApproximateReceiveCount"])
        for message in result.get("Messages", []):
            body = json.loads(message["Body"])
            instance_id = body["instance_id"]
            if body.get("parameters", {}).get("force_failure"):
                print(f"intentional failure for {instance_id}; receive={message.get('Attributes')}", flush=True)
                continue
            if body["action"] == "deprovision":
                set_state(ddb, instance_id, "succeeded", "routing resource removed")
            else:
                time.sleep(1)
                set_state(ddb, instance_id, "succeeded", "desired state persisted; route ready for publication")
            sqs.delete_message(QueueUrl=queue_url, ReceiptHandle=message["ReceiptHandle"])


if __name__ == "__main__":
    run()
