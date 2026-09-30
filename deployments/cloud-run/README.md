# Plane on Cloud Run (fork notes)

This fork changes one thing: the API image ships `google-cloud-pubsub` and
`google-cloud-monitoring`, so Celery can use kombu's `gcpubsub://` transport
instead of RabbitMQ. No application code is modified.

Build and run locally (Pub/Sub emulator, Valkey, Postgres, MinIO):

    docker build -f apps/api/Dockerfile.api -t plane-backend:pubsub apps/api
    docker compose -f docker-compose.yml -f deployments/cloud-run/docker-compose.pubsub.yml up -d

## Compose service to GCP product

| Compose service | Cloud Run shape | GCP product |
|---|---|---|
| plane-db (Postgres) | n/a | Cloud SQL for PostgreSQL |
| plane-redis (Valkey 7.2) | n/a | Memorystore for Valkey |
| pubsub (emulator) | n/a | Cloud Pub/Sub (drop `PUBSUB_EMULATOR_HOST`, set `AMQP_URL=gcpubsub://projects/<project>`) |
| plane-minio | n/a | GCS via S3 interoperability (HMAC keys) |
| api, migrator | service / job | Cloud Run |
| worker, beat-worker | service (min instances 1, CPU always allocated) | Cloud Run |
| web, admin, live, proxy | service | Cloud Run |

Cloud SQL and Memorystore need VPC access (Direct VPC egress). Only one
beat-worker may run. Nothing here has been deployed to GCP.
