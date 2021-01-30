import * as SSH2Shell from 'ssh2shell';
import * as fs from 'fs';
import * as path from 'path';
import {Logging} from './helpers/common.interface';
import log from './helpers/log';
import sleep from './helpers/sleep';

const NODE_DEBUG = process.env.NODE_DEBUG as unknown as Logging;

export class OvpnSSH {

    async setupOpenVPNEC2Instance(publicIp: string, keyPairInBaseDir: string, newPassword: string, numberOfRetries = 5): Promise<void> {
        log(Logging.LOG, 'setup OpenVPN EC2 instance');
        // debugging will only occur if NODE_DEBUG is set to anything
        const debugForSSH2Shell = !!NODE_DEBUG;
        const verboseForSSH2Shell = !!NODE_DEBUG;

        return new Promise((resolve, reject) => {
            const host = {
                server: {
                    host: publicIp,
                    userName: 'openvpnas',
                    tryKeyboard: true,
                    privateKey: fs.readFileSync(path.join(__dirname, '../../', `${keyPairInBaseDir}.pem`)).toString(),
                },
                debug: debugForSSH2Shell,
                verbose: verboseForSSH2Shell,
                commands: [
                    // for additional details https://www.vembu.com/blog/open-vpn-server-aws-overview/

                    // EULA to use OpenVPN, types yes
                    'yes',
                    // Will this be the primary Access Server node?
                    // default (yes)
                    'yes',
                    //  the network interface and IP address to be used by the Admin Web UI
                    // (1) all interfaces: 0.0.0.0
                    // (2) eth0: {IP_ADDRESS}
                    // default (1)
                    '1',
                    // Please specify the port number for the Admin Web UI.
                    // default (943)
                    '943',
                    // Please specify the TCP port number for the OpenVPN Daemon?
                    // default (443)
                    '443',
                    // Should client traffic be routed by default through the VPN?
                    // default (no)

                    // use "yes" to automatically configure this and therefore not requiring to access the admin panel to enable
                    'yes',
                    // Should client DNS traffic be routed by default through the VPN?
                    // default (no)
                    'no',
                    // Use local authentication via internal DB?
                    // default (yes)
                    'yes',
                    // Should private subnets be accessible to clients by default?
                    // Press ENTER for EC2 default [yes]
                    'yes',
                    // Do you wish to downloadOpenVpnClient to the Admin UI as "openvpn"?
                    // default (yes)
                    'yes',
                    // Please specify your Activation key (or leave blank to specify later)
                    // default ("")

                    '\n', // I don't believe this is as good it could be but it works

                    // at this point configuration will start/complete, once done it will tell you you can use the "openvpn" password
                    // used to authenticate with the host, but we logged in with a key and don't know our password

                    // proceed to change the "openvpn" user password as root user
                    'sudo -i',
                    'passwd openvpn',
                    // enter password and confirm
                    newPassword,
                    newPassword,
                    // will complete at this point, no need to exit
                ],

                msg: {
                    send: function (message) {
                        log(Logging.LOG, message);
                    }
                },

                connectedMessage: 'Successfully connected to the server',
                readyMessage: 'Attempting to configure OpenVPN server.  This may take a minute',

                // add ":" for accepting the OpenVPN acceptance
                // it's possibly we can remove some of these for safety
                standardPrompt: '>$%#:',

                // for debugging, `onCommandComplete`, `onCommandProcessing`, `onEnd` function was the most helpful in order
                // "How to test the response of a command and add more commands and notifications in the onCommandComplete callback function"
                /**
                 *
                 * @param command   the command that will be run
                 * @param response  the response is what's appearing in the terminal
                 * @param sshObj
                 * @param stream
                 */
                onCommandProcessing: function (command: string, response: string, sshObj: any, stream: string) {
                    if (sshObj.debug) {
                        // we only want to see when something is happening
                        // the response does contain the command as well
                        if (command !== '') {
                            log(Logging.LOG, response);
                        }

                    }
                },

                onCommandTimeout: function (/*command: string, response: string, stream, connection: string*/) {
                    // I think this is necessary for the Activation Key "empty string" above to continue otherwise it just hangs
                    // log(Logging.LOG, 'TIMEOUT')
                },

                onError: async (err, type, /*close = false, callback*/) => {
                    //err is either an Error object or a string containing the error message
                    //type is a string containing the error type
                    //close is a Boolean value indicating if the connection should be closed or not
                    //callback is the function to run with handling the error in the form of function(err,type)
                    //if overwriting the default definition remember to handle closing the connection based on close
                    //To close the connection us this.connection.close()
                    // @ts-ignore
                    if (NODE_DEBUG === 'ERROR') {
                        log(Logging.ERROR, err);
                        log(Logging.ERROR, type);
                    }

                    // if we can't connect we'll attempt a few reconnects before failing
                    if (type === 'Connection') {
                        if (numberOfRetries <= 0) {
                            throw new Error('Could not connect via SSH to AWS server');
                        }
                        await sleep(3000);
                        log(Logging.LOG, 'Could not connect, will re-attempt:', numberOfRetries);

                        try {
                            numberOfRetries--;
                            await this.setupOpenVPNEC2Instance(publicIp, keyPairInBaseDir, newPassword, numberOfRetries);
                            // although we are inside an error
                            // the previous call will either continuously error or hit this next line and resolve back
                            resolve();
                        } catch(e) {
                            // the previously command will continously call itself until it runs out of retries and then
                            // it'll finally just error out
                            reject(e);
                        }
                    }
                },
            };

            const callback = function(fullOutput: string) {
                // output could be the output from all the commands
                // good for troubleshooting

                // if it's a connection error, it'll be an empty string (no output)
                // we'll check to see for a specific message and resolve if so
                if (fullOutput.includes('Configuration Complete')) {
                    log(Logging.SUCCESS, `\u2713 Successfully setup, admin panel can be accessed at https://${publicIp}:943/admin.  This may show a warning when loading in the browser as it's an unsecure connection, this is expected`);
                    resolve();
                }
            };

            // Create a new ssh2shell instance passing in the host object
            const SSH = new SSH2Shell(host);
            SSH.connect(callback);
        });
    }
}
