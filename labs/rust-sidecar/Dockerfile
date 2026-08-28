FROM rust:1.89-bookworm AS build
WORKDIR /src
COPY Cargo.toml ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN useradd --system --uid 10001 sidecar
COPY --from=build /src/target/release/edge-policy-sidecar /usr/local/bin/edge-policy-sidecar
USER 10001
EXPOSE 9000
ENTRYPOINT ["edge-policy-sidecar"]
