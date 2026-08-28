import os
import time

import boto3
from botocore.exceptions import ClientError, EndpointConnectionError

REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-1")
SQS_ENDPOINT = os.getenv("SQS_ENDPOINT")
DDB_ENDPOINT = os.getenv("DDB_ENDPOINT")
TABLE_NAME = os.getenv("TABLE_NAME", "atl-service-instances")
QUEUE_NAME = os.getenv("QUEUE_NAME", "atl-provisioning")
DLQ_NAME = os.getenv("DLQ_NAME", "atl-provisioning-dlq")


def clients():
    sqs = boto3.client("sqs", region_name=REGION, endpoint_url=SQS_ENDPOINT)
    ddb = boto3.client("dynamodb", region_name=REGION, endpoint_url=DDB_ENDPOINT)
    return sqs, ddb


def ensure_resources(max_attempts: int = 30):
    sqs, ddb = clients()
    for attempt in range(max_attempts):
        try:
            dlq_url = sqs.create_queue(QueueName=DLQ_NAME)["QueueUrl"]
            dlq_arn = sqs.get_queue_attributes(QueueUrl=dlq_url, AttributeNames=["QueueArn"])["Attributes"]["QueueArn"]
            queue_url = sqs.create_queue(
                QueueName=QUEUE_NAME,
                Attributes={
                    "VisibilityTimeout": "3",
                    "ReceiveMessageWaitTimeSeconds": "2",
                    "RedrivePolicy": f'{{"deadLetterTargetArn":"{dlq_arn}","maxReceiveCount":"3"}}',
                },
            )["QueueUrl"]
            try:
                ddb.create_table(
                    TableName=TABLE_NAME,
                    KeySchema=[{"AttributeName": "instance_id", "KeyType": "HASH"}],
                    AttributeDefinitions=[{"AttributeName": "instance_id", "AttributeType": "S"}],
                    BillingMode="PAY_PER_REQUEST",
                )
            except ddb.exceptions.ResourceInUseException:
                pass
            return sqs, ddb, queue_url, dlq_url
        except (EndpointConnectionError, ClientError):
            if attempt == max_attempts - 1:
                raise
            time.sleep(1)
    raise RuntimeError("local AWS emulators did not become ready")
