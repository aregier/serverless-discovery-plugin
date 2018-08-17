import { ApiCredentialType, IAMCredentials } from '@adastradev/serverless-discovery-sdk'

const ACCESS_KEY: string = 'accessKeyId'
const SECRET_KEY: string = 'secretAccessKey'

export class PluginIAMCredentials implements IAMCredentials { // tslint:disable-line
    public accessKeyId: string
    public secretAccessKey: string
    public type: ApiCredentialType

    constructor(config: DiscoveryConfig, environment = process.env) {
        if (this.hasNonEmptyValue(config, ACCESS_KEY) && this.hasNonEmptyValue(config, SECRET_KEY)) {
            this.accessKeyId = config[ACCESS_KEY] || ''
            this.secretAccessKey = config[SECRET_KEY] || ''
        } else {
            this.accessKeyId = environment.AWS_ACCESS_KEY_ID || ''
            this.secretAccessKey = environment.AWS_SECRET_ACCESS_KEY || ''
        }
        this.type = 'IAM'
    }

    private hasNonEmptyValue(config: DiscoveryConfig, key: string) {
        return (config && config[key] && config[key].length > 0)
    }
}
