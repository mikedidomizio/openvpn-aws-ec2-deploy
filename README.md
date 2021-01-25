# openvpn-aws-ec2-deploy

## What does this do
This package will start an OpenVPN EC2 instance which you can use the OpenVPN client to connect to.

This allows for a quick start, quick use VPN.

The image is [OpenVPN Access Server](https://aws.amazon.com/marketplace/pp/OpenVPN-Inc-OpenVPN-Access-Server/B00MI40CAE) 
with instance type of [`t2.micro`](https://aws.amazon.com/ec2/instance-types/t2/)

## What happens with the script
- Generates keypair for this server
- Generates security group for this server
- Generates an EC2 instance
- Uses SSH to set up OpenVPN server configuration
- Downloads OpenVPN client to the file system for connection

## Getting started
- Run `git clone https://github.com/mikedidomizio/openvpn-aws-ec2-deploy`
- Run `npm install` within the directory
- Run `npm run start`

## Requirements
- AWS CLI
- AWS IAM account configured with EC2 privileges
- NodeJS 

## Notes
- **Does not shut down instance! Make sure to shut your instance down**
- Only tested on Windows
- Not responsible for any costs/billing that occurs
- Use at your own risk
