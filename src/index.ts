import {Instance} from './lib/instance';
import {OvpnSSH} from './lib/ovpn-ssh.class';
import {SecurityGroup} from './lib/security-group.class';
import {KeyPair} from './lib/key-pair.class';
import * as fs from 'fs';
import {execSync} from 'child_process';
import sleep from './lib/helpers/sleep';
import log from './lib/helpers/log';
import {Logging} from './lib/helpers/common.interface';
import {performance} from 'perf_hooks';
import {OvpnWeb} from './lib/ovpn-web.class';
import {CONSTANTS} from './const';

/**
 * Proceeds to create everything required to launch a OpenVPN server in EC2
 */
(async () => {
    const startTime = performance.now();
    // AWS_PROFILE is an env the aws cli uses for profile switching
    if (process.env.AWS_PROFILE) {
        log(Logging.LOG, `AWS_PROFILE=${process.env.AWS_PROFILE}`);
    } else {
        log(Logging.WARN, 'Using default AWS profile');
    }

    // AMI for the OpenVPN Access Server (https://aws.amazon.com/marketplace/pp/OpenVPN-Inc-OpenVPN-Access-Server/B00MI40CAE)
    const ami = 'ami-037ff6453f0855c46';
    // the micro tier is 'free'
    const instanceSize = 't2.micro';
    let securityGroupId: string;
    const keyPairName = 'open-vpn-key-pair';

    // password
    const defaultPassword = 'openvpn';
    const newPassword = process.env.OPENVPN_PASSWORD ? process.env.OPENVPN_PASSWORD : defaultPassword;
    if (newPassword === defaultPassword) {
        log(Logging.WARN, 'env OPENVPN_PASSWORD is not set, using default');
    }

    const groupName = 'OpenVPN security group to allow access to necessary ports';
    const groupDescription = 'this group was automatically generated from a script';

    const awsEC2 = new Instance();
    const securityGroup = new SecurityGroup();
    const keyPair = new KeyPair();
    const myIP = execSync('curl https://checkip.amazonaws.com', { stdio: 'pipe' }).toString().trim();

    // KEY PAIR
    try {
        const response = await keyPair.create(keyPairName);
        // this is the PEM so handle with care
        const privateKey = JSON.parse(response).KeyMaterial;
        log (Logging.WARN, `Saving private key to ${keyPairName}.pem`);
        await fs.writeFileSync(`${keyPairName}.pem`, privateKey);
    } catch(e) {
        // keypair with name already created, this should be in the parent directory of this project
        try {
            fs.readFileSync(`${keyPairName}.pem`);
        } catch(e) {
            throw new Error('keypair does not exist locally.  Please delete from AWS otherwise change the keypair name that is generated');
        }
    }

    // SECURITY GROUP
    try {
        const response = await securityGroup.createGroup(groupName, groupDescription);
        securityGroupId = JSON.parse(response).GroupId;
    } catch (e) {
        // we will get the security group to ensure all permissions have been added below
        const response = await securityGroup.getSecurityGroupByName(groupName);
        securityGroupId = JSON.parse(response).SecurityGroups[0].GroupId;
    }

    try {
        await Promise.all([
            // these were default ports created when creating the instance through the web
            // rejections will occur if any had previously existed
            securityGroup.addRule(securityGroupId, 'TCP', 22, `${myIP}/24`),
            securityGroup.addRule(securityGroupId, 'TCP', 443, `${myIP}/24`),
            securityGroup.addRule(securityGroupId, 'TCP', 943, `${myIP}/24`),
            securityGroup.addRule(securityGroupId, 'TCP', 945, `${myIP}/24`),
            securityGroup.addRule(securityGroupId, 'TCP', 1194, `${myIP}/24`)
        ]);
    } catch (e) {
        // security group rules (hopefully) all added
    }

    // CREATE THE INSTANCE
    const response = await awsEC2.createAndRunInstance(ami, instanceSize, keyPairName, [{
        Key: CONSTANTS.TAG_KEY_NAME, Value: '-'
    }],securityGroupId);
    const parsedResponse = JSON.parse(response);
    const instanceId = parsedResponse.Instances[0].InstanceId;

    if (!instanceId) {
        throw new Error(`Bad instance ID: ${instanceId}`);
    }

    // wait for instance up
    const publicIp = await awsEC2.pollForInstanceRunningByInstanceIdReturnIp(instanceId, instanceSize);

    // SSH into the instance and setup OVPN
    await new OvpnSSH().setupOpenVPNEC2Instance(publicIp, keyPairName, newPassword);

    const ovpnWeb = new OvpnWeb(publicIp);
    // wait for the web portal to be accessible, it takes a few seconds
    await ovpnWeb.pollWebPortalIsUp();
    await ovpnWeb.downloadOpenVpnClient('openvpn', newPassword);

    const endTime = performance.now();
    const difference = ((endTime - startTime) / 1000).toFixed(2);
    log(Logging.SUCCESS, `Finished creating OpenVPN on EC2 in ${difference} seconds`);
    log(Logging.SUCCESS, 'Take the client and import it into OpenVPN Connect');
    log(Logging.SUCCESS, '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^');
})();
