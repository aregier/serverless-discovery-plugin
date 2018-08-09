import * as assert from 'assert'
import * as util from 'util'

import StackOutputFile from './file'
import { DiscoveryServiceApi,
  IAMCredentialsEnvironmentVariables,
  ServiceApiModel } from '@adastradev/serverless-discovery-sdk'

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
    return util.format('%s-%s',
      this.serverless.service.getServiceName(),
      this.serverless.getProvider('aws').getStage()
    )
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

    require(file)[func](
      data,
      this.serverless,
      this.options
    )

    return Promise.resolve()
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

  private beautify (data: {Stacks: Array<{ Outputs: StackOutputPair[] }>}) {
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
          new IAMCredentialsEnvironmentVariables())

        const service: ServiceApiModel = {
            ServiceName: this.serverless.service.getServiceName(),
            ServiceURL: data['ServiceEndpoint'], // tslint:disable-line
            StageName: this.serverless.getProvider('aws').getStage()
        }

        const result = await discoveryApi.createService(service)
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
          new IAMCredentialsEnvironmentVariables())

        const response = await discoveryApi.lookupService(
          this.serverless.service.getServiceName(),
          this.serverless.getProvider('aws').getStage()
        )

        const existingService: ServiceApiModel = response.data[0]
        if (existingService !== undefined && existingService.ServiceID !== undefined) {
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
