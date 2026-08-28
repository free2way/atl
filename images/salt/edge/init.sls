edge_packages:
  pkg.installed:
    - pkgs:
      - ca-certificates
      - curl
      - jq

/etc/atl-edge:
  file.directory:
    - user: root
    - group: root
    - mode: '0755'

/etc/atl-edge/release:
  file.managed:
    - contents: |
        role=edge-proxy
        build_contract=v1
    - user: root
    - group: root
    - mode: '0644'
    - require:
      - file: /etc/atl-edge
