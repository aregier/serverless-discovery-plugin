import * as assert from 'assert'
import * as util from 'util'

import { DiscoveryServiceApi,
  ServiceApiModel } from '@adastradev/serverless-discovery-sdk'

import StackOutputFile from './file'
import { PluginIAMCredentials } from './PluginIAMCredentials'

export default class ServiceDiscoveryPlugin {
  public hooks: {}
  private discoveryConfig: DiscoveryConfig

  constructor (
    private serverless: Serverless,
    private options: Serverless.Options
  ) {
    this.hooks = {
      'after:deploy:deploy': this.deploy.bind(this),
      'before:remove:remove': this.remove.bind(this)
    }

    this.discoveryConfig = this.serverless.service.custom.discovery
  }

  get file () {
    return this.getConfigPathValue('file')
  }

  get deployHandler () {
    return this.getConfigPathValue('deployHandler')
  }

  get removeHandler () {
    return this.getConfigPathValue('removeHandler')
  }

  get discoveryServiceUri () {
    return this.getConfig('discoveryServiceUri')
  }

  get stackName () {
    return this.serverless.getProvider('aws').naming.getStackName()
  }

  public hasConfig (key: string) {
    return !!this.discoveryConfig && !!this.discoveryConfig[key]
  }

  public hasDeployHandler () {
    return this.hasConfig('deployHandler')
  }

  public hasRemoveHandler () {
    return this.hasConfig('removeHandler')
  }

  public hasDiscoveryServiceUri () {
    return this.hasConfig('discoveryServiceUri')
  }

  public hasFile () {
    return this.hasConfig('file')
  }

  public processDeploymentPropTags (propData: object, deploymentData: object) {
    let result

    this.serverless.cli.log(`Processing deployment prop tags ${JSON.stringify(propData)} in serviceUrl`)

    if (!propData) {
      return result
    }

    result = {}
    for (const property of Object.keys(propData)) {
      const childProp = propData[property]

      this.serverless.cli.log(`Processing property ${property} in serviceUrl`)

      // see if this child property is using the @DeploymentProp
      if (childProp['@DeploymentProp']) {
        result[property] = deploymentData[childProp['@DeploymentProp']]
        this.serverless.cli.log(`Using deployment property ${childProp['@DeploymentProp']} in serviceUrl`)
      } else {
        result[property] = propData[property]
      }
    }

    return result
  }

  private getConfigPathValue (key: string) {
    return util.format('%s/%s',
      this.serverless.config.servicePath,
      this.discoveryConfig[key]
    )
  }

  private getConfig (key: string) {
    return this.discoveryConfig[key]
  }

  private callHandler (handler: string, data: object) {
    const splits = handler.split('.')
    const func = splits.pop() || ''
    const file = splits.join('.')

    return require(file)[func](
      data,
      this.serverless,
      this.options
    )
  }

  private saveFile (data: object) {
    const f = new StackOutputFile(this.file)

    return f.save(data)
  }

  private fetch (): Promise<StackDescriptionList> {
    return this.serverless.getProvider('aws').request(
      'CloudFormation',
      'describeStacks',
      { StackName: this.stackName },
      this.serverless.getProvider('aws').getStage(),
      this.serverless.getProvider('aws').getRegion()
    )
  }

  private beautify (data: {Stacks: { Outputs: StackOutputPair[] }[]}) {
    const stack = data.Stacks.pop() || { Outputs: [] }
    const output = stack.Outputs || []

    return output.reduce(
      (obj, item: StackOutputPair) => (
        Object.assign(obj, { [item.OutputKey]: item.OutputValue })
      ), {}
    )
  }

  private handleDeploy (data: object) {
    return Promise.all(
      [
        this.register(data),
        this.handleDeployHandler(data),
        this.handleFile(data)
      ]
    )
  }

  private handleRemove (data: object) {
    return Promise.all(
      [
        this.deregister(data),
        this.handleRemoveHandler(data)
      ]
    )
  }

  private register(data: object) {
    return this.hasDiscoveryServiceUri() ? (
      new Promise<any>(async (resolve, reject) => {
        this.serverless.cli.log('Registering service endpoint with service: ' + this.discoveryServiceUri)

        const discoveryApi = new DiscoveryServiceApi(this.discoveryServiceUri,
          this.serverless.getProvider('aws').getRegion(),
          new PluginIAMCredentials(this.discoveryConfig))

        // The custom, free form field under custom.discovery supports referencing
        // deployment information like endpoints and function arns using the @DeploymentProp tag.
        //
        // A sample serverless.yml entry using deployment property references
        //  serviceURL: {
        //    servicePath: {'@DeploymentProp':'ServiceEndpoint'},
        //    someLambdaFunctionArn: {'@DeploymentProp':'SomeLambdaFunctionArnLambdaFunctionQualifiedArn'}
        //  }
        //
        const customServiceUrl = this.processDeploymentPropTags(this.getConfig('serviceURL'), data)

        const service: ServiceApiModel = {
          ExternalID: this.getConfig('externalID'),
          ServiceName: this.serverless.service.getServiceName(),
          // This data variable is looking for the service endpoint from CloudFormation
          // The alternative will look for a custom, freeform field under custom.discovery
          // in the Serverless.yml
          ServiceURL: JSON.stringify(customServiceUrl) || data['ServiceEndpoint'], // tslint:disable-line
          StageName: this.serverless.getProvider('aws').getStage(),
          Version: this.getConfig('version')
        }

        this.serverless.cli.log(`Registering: ${JSON.stringify(service)}`)
        const result = await discoveryApi.createService(service)
        this.serverless.cli.log('Successfully registered.')

        return resolve(result)
      })
    ) : Promise.resolve()
  }

  private deregister(data: object) {
    return this.hasDiscoveryServiceUri() ? (
      new Promise<any>(async (resolve, reject) => {
        this.serverless.cli.log('De-registering service endpoint with service: ' + this.discoveryServiceUri)
        const discoveryApi = new DiscoveryServiceApi(this.discoveryServiceUri,
          this.serverless.getProvider('aws').getRegion(),
          new PluginIAMCredentials(this.discoveryConfig))

        const response = await discoveryApi.lookupService(
          this.serverless.service.getServiceName(),
          this.serverless.getProvider('aws').getStage(),
          this.getConfig('version'),
          this.getConfig('externalID')
        )

        const existingService: ServiceApiModel = response.data[0]

        if (existingService !== undefined && existingService.ServiceID !== undefined) {
          this.serverless.cli.log(`Found service to delete: ${JSON.stringify(existingService)}`)
          await discoveryApi.deleteService(existingService.ServiceID)
          this.serverless.cli.log('Successfully de-registered service')
          return resolve(existingService.ServiceID)
        } else {
          this.serverless.cli.log('No service registration record was found for this service name and stage')
          return resolve(null)
        }
      })
    ) : Promise.resolve()
  }

  private handleDeployHandler(data: object) {
    return this.hasDeployHandler() ? (
      this.callHandler(
        this.deployHandler,
        data
      ).then(
        () => this.serverless.cli.log(
          util.format('Stack Output processed with handler: %s', this.deployHandler)
        )
      )
    ) : Promise.resolve()
  }

  private handleRemoveHandler(data: object) {
    return this.hasRemoveHandler() ? (
      this.callHandler(
        this.removeHandler,
        data
      ).then(
        () => this.serverless.cli.log(
          util.format('Stack Output processed with handler: %s', this.removeHandler)
        )
      )
    ) : Promise.resolve()
  }

  private handleFile(data: object) {
    return this.hasFile() ? (
      this.saveFile(
        data
      ).then(
        () => this.serverless.cli.log(
          util.format('Stack Output saved to file: %s', this.discoveryConfig.file)
        )
      )
    ) : Promise.resolve()
  }

  private validate () {
    assert(this.serverless, 'Invalid serverless configuration')
    assert(this.serverless.service, 'Invalid serverless configuration')
    assert(this.serverless.service.provider, 'Invalid serverless configuration')
    assert(this.serverless.service.provider.name, 'Invalid serverless configuration')
    assert(this.serverless.service.provider.name === 'aws', 'Only supported for AWS provider')

    assert(this.options && !this.options.noDeploy, 'Skipping deployment with --noDeploy flag')
  }

  private async deploy () {
    try {
      await this.validate()
      const rawData = await this.fetch()
      const beautifulData = await this.beautify(rawData)
      await this.handleDeploy(beautifulData)
    } catch (Error) {
      this.serverless.cli.log(
        util.format('Cannot process Discovery Plugin: %s!', Error.message))
    }
  }

  private async remove () {
    try {
      await this.validate()
      const rawData = await this.fetch()
      const beautifulData = await this.beautify(rawData)
      await this.handleRemove(beautifulData)
    } catch (Error) {
      this.serverless.cli.log(
        util.format('Cannot process Discovery Plugin: %s!', Error.message))
    }
  }
}
