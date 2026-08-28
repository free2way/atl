use axum::{
    Json, Router,
    http::StatusCode,
    routing::{get, post},
};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct CheckRequest {
    token: String,
    tenant: String,
}

#[derive(Serialize)]
struct CheckResponse {
    allowed: bool,
    reason: &'static str,
}

fn app() -> Router {
    Router::new()
        .route("/healthz", get(|| async { "ok" }))
        .route("/check", post(check))
}

async fn check(Json(request): Json<CheckRequest>) -> (StatusCode, Json<CheckResponse>) {
    let allowed = request.token == "lab-token" && request.tenant == "team-a";
    let status = if allowed {
        StatusCode::OK
    } else {
        StatusCode::FORBIDDEN
    };
    let reason = if allowed { "policy matched" } else { "policy rejected" };
    (status, Json(CheckResponse { allowed, reason }))
}

#[tokio::main]
async fn main() {
    let listener = tokio::net::TcpListener::bind("0.0.0.0:9000")
        .await
        .expect("bind sidecar port");
    axum::serve(listener, app()).await.expect("serve sidecar");
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt;

    #[tokio::test]
    async fn accepts_known_tenant_and_token() {
        let response = app()
            .oneshot(
                Request::post("/check")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"token":"lab-token","tenant":"team-a"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn rejects_cross_tenant_request() {
        let response = app()
            .oneshot(
                Request::post("/check")
                    .header("content-type", "application/json")
                    .body(Body::from(r#"{"token":"lab-token","tenant":"team-b"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
    }
}
