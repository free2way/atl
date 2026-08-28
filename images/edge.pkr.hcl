packer {
  required_plugins {
    amazon = {
      source  = "github.com/hashicorp/amazon"
      version = ">= 1.3.9"
    }
    docker = {
      source  = "github.com/hashicorp/docker"
      version = ">= 1.1.1"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "ap-southeast-1"
}

source "docker" "edge" {
  image  = "ubuntu:24.04"
  commit = true
}

source "amazon-ebs" "edge" {
  region        = var.aws_region
  instance_type = "t3.micro"
  ssh_username  = "ec2-user"
  ami_name      = "atl-edge-{{timestamp}}"

  source_ami_filter {
    filters = {
      architecture        = "x86_64"
      name                = "al2023-ami-2023.*-x86_64"
      root-device-type    = "ebs"
      virtualization-type = "hvm"
    }
    most_recent = true
    owners      = ["amazon"]
  }

  tags = {
    Name      = "atl-edge-golden"
    Project   = "atl-edge-lab"
    ManagedBy = "packer"
  }
}

build {
  name    = "local-edge"
  sources = ["source.docker.edge"]

  provisioner "shell" {
    script = "images/scripts/provision-edge.sh"
  }

  post-processor "docker-tag" {
    repository = "atl-edge-golden"
    tags       = ["lab"]
  }
}

build {
  name    = "aws-edge"
  sources = ["source.amazon-ebs.edge"]

  provisioner "shell" {
    script = "images/scripts/provision-edge.sh"
  }
}
