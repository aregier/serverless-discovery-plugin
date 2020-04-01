import using from 'jasmine-data-provider'
import util from 'util'

import { PluginIAMCredentials } from '../src/PluginIAMCredentials'
import { DiscoveryConfig } from '../vendor/main'

describe('PluginIAMCredentials', () => {
  describe('Constructor', () => {
    it('pass path', () => {
      const config: DiscoveryConfig = {
        accessKeyId: 'TestKeyValue',
        secretAccessKey: 'TestSecretKeyValue'
      }
      const creds = new PluginIAMCredentials(config)
      expect(creds.accessKeyId).toBe('TestKeyValue')
      expect(creds.secretAccessKey).toBe('TestSecretKeyValue')
    })

    it('missing secretKey path', () => {
      const config: DiscoveryConfig = {
        accessKeyId: 'TestKeyValue',
        secretAccessKey: ''
      }
      const creds = new PluginIAMCredentials(config)
      expect(creds.accessKeyId).toBe(process.env.AWS_ACCESS_KEY_ID || '')
      expect(creds.secretAccessKey).toBe(process.env.AWS_SECRET_ACCESS_KEY || '')
    })
  })
})
