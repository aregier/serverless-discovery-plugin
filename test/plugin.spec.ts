import sinon from 'sinon'

import Plugin from '../src/plugin'

describe('Plugin', () => {
  let providerMock = null
  let getProvider = null
  const provider = {
    request: () => true,
    sdk: {
      VERSION: '2.21.0'
    }
  }

  beforeEach(() => {
    providerMock = sinon.mock(provider)
    getProvider = sinon.stub().returns(provider)
  })

  afterEach(() => {
    providerMock.restore()
  })

  describe('Configuration', () => {
    it('hasDeployHandler', () => {
      const config = {
        cli: { log: () => null },
        config: {
          servicePath: ''
        },
        getProvider,
        region: 'us-east-1',
        service: {
          custom: {
            discovery: {
              deployHandler: 'foo/bar.baz'
            }
          },
          provider: {
            name: 'aws'
          }
        }
      }

      const test = new Plugin(config, {})

      expect(test.hasDeployHandler()).toBe(true)
      expect(test.hasRemoveHandler()).toBe(false)
      expect(test.hasFile()).toBe(false)
      expect(test.hasDiscoveryServiceUri()).toBe(false)

      expect(test.deployHandler).toContain('foo/bar.baz')
    })
  })

  describe('Configuration', () => {
    it('hasRemoveHandler', () => {
      const config = {
        cli: { log: () => null },
        config: {
          servicePath: ''
        },
        getProvider,
        region: 'us-east-1',
        service: {
          custom: {
            discovery: {
              removeHandler: 'foo/bar.baz'
            }
          },
          provider: {
            name: 'aws'
          }
        }
      }

      const test = new Plugin(config, {})

      expect(test.hasDeployHandler()).toBe(false)
      expect(test.hasRemoveHandler()).toBe(true)
      expect(test.hasFile()).toBe(false)
      expect(test.hasDiscoveryServiceUri()).toBe(false)

      expect(test.removeHandler).toContain('foo/bar.baz')
    })
  })

  describe('Configuration', () => {
    it('hasDiscoveryServiceUri', () => {
      const config = {
        cli: { log: () => null },
        config: {
          servicePath: ''
        },
        getProvider,
        region: 'us-east-1',
        service: {
          custom: {
            discovery: {
              discoveryServiceUri: 'https://abcdefghij.execute-api.us-east-1.amazonaws.com/dev'
            }
          },
          provider: {
            name: 'aws'
          }
        }
      }

      const test = new Plugin(config, {})

      expect(test.hasDeployHandler()).toBe(false)
      expect(test.hasRemoveHandler()).toBe(false)
      expect(test.hasFile()).toBe(false)
      expect(test.hasDiscoveryServiceUri()).toBe(true)

      expect(test.discoveryServiceUri).toContain('https://abcdefghij.execute-api.us-east-1.amazonaws.com/dev')
    })
  })

  describe('Configuration', () => {
    it('hasFile', () => {
      const config = {
        cli: { log: () => null },
        config: {
          servicePath: ''
        },
        getProvider,
        region: 'us-east-1',
        service: {
          custom: {
            discovery: {
              file: 'foo/bar.toml'
            }
          },
          provider: {
            name: 'aws'
          }
        }
      }

      const test = new Plugin(config, {})

      expect(test.hasDeployHandler()).toBe(false)
      expect(test.hasRemoveHandler()).toBe(false)
      expect(test.hasFile()).toBe(true)
      expect(test.hasDiscoveryServiceUri()).toBe(false)

      expect(test.file).toContain('foo/bar.toml')
    })
  })

  describe('processDeploymentPropTags', () => {
    it('should correctly parse deployment tags and create output object', () => {
      const config = {
        cli: { log: () => null },
        config: {
          servicePath: ''
        },
        getProvider,
        region: 'us-east-1',
        service: {
          custom: {
            discovery: {
              file: 'foo/bar.toml'
            }
          },
          provider: {
            name: 'aws'
          }
        }
      }

      const propTagObject = {
        nonPropValue: 'unchanged value',
        servicePath: {'@DeploymentProp': 'ServiceEndpoint'},
        someLambdaFunctionArn: {'@DeploymentProp': 'SomeLambdaFunctionArnLambdaFunctionQualifiedArn'}
      }

      const deployedPropsObject = {
        ServiceEndpoint: 'https:someurl.com/1234',
        SomeLambdaFunctionArnLambdaFunctionQualifiedArn: 'service-1234-serverlessdeploymentbuck-1vjy5rcxdcfce'
      }

      const test = new Plugin(config, {})
      const result = test.processDeploymentPropTags(propTagObject, deployedPropsObject)

      expect(result.servicePath).toEqual(deployedPropsObject.ServiceEndpoint)
      expect(result.someLambdaFunctionArn).toEqual(deployedPropsObject.SomeLambdaFunctionArnLambdaFunctionQualifiedArn)
      expect(result.nonPropValue).toEqual('unchanged value')

      // verify that stringify of undefined returns undefined. required
      // behavior in processing of deployment props
      const stringify = JSON.stringify(undefined)
      expect(stringify).toBe(undefined)
    })
  })

})
