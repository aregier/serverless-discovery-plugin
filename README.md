# Serverless Discovery Plugin

[![codecov](https://codecov.io/bb/adastradev/serverless-discovery-plugin/branch/master/graph/badge.svg?token=b2XEsAGvcN)](https://codecov.io/bb/adastradev/serverless-discovery-plugin)

[![NPM](https://nodei.co/npm/serverless-discovery-plugin.png)](https://nodei.co/npm/serverless-discovery-plugin/)

[![npm](https://img.shields.io/npm/v/serverless-discovery-plugin.svg)](https://www.npmjs.com/package/serverless-discovery-plugin)
[![license](https://img.shields.io/npm/l/serverless-discovery-plugin.svg)](https://www.npmjs.com/package/serverless-discovery-plugin)
[![CircleCI](https://img.shields.io/circleci/project/github/aregier/serverless-discovery-plugin.svg)](https://circleci.com/gh/aregier/serverless-discovery-plugin)
[![Coveralls](https://img.shields.io/coveralls/aregier/serverless-discovery-plugin.svg)](https://coveralls.io/github/aregier/serverless-discovery-plugin)

A [serverless](https://serverless.com) plugin to register AWS micro-service endpoints with a discovery service at `serverless deploy` or `serverless remove` time, or to pass the output to a JavaScript function for further processing.

See the [Ad Astra Serverless Discovery](https://adastradev.github.io/serverless-discovery/) project for more information.

## Usage

### Install

```bash
$ > yarn add serverless-discovery-plugin
```

```bash
$ > npm install serverless-discovery-plugin
```

### Configuration

```yaml
plugins:
  - serverless-discovery-plugin

custom:
  discovery:
    discoveryServiceUri: 'https://abcdefghij.execute-api.us-east-1.amazonaws.com/dev'
    accessKeyId: ${env:DISCOVERY_KEY_ID} # optional, if separate keys are needed
    secretAccessKey: ${env:DISCOVERY_SECRET_ACCESS_KEY} # optional, if separate keys are needed
    deployHandler: scripts/deploy.handler # Same syntax as you already know
    removeHandler: scripts/remove.handler # Same syntax as you already know
    file: .build/stack.toml # toml, yaml, yml, and json format is available
    version: 1.0.0 # you could alternatively source this from package.json, etc.
    externalID: An alternative identifier/stage name for your service deployment
```
## Storing custom properties as part of service URL
The service URL can store a JSON object of data as part of the registration process.  Setting the value of `serviceURL` with additional properties will store the additional properties with the service registration.  These additional properties will be returned when requesting the service information from the discovery service.

### Example:
```yaml
    serviceURL: {
      jobName: '${self:service}-${env:STAGE_NAME}',
      jobDefinition: '${self:service}-${env:STAGE_NAME}'
    }
```
## Referencing calculated serverless stack deployment properties
The custom properties stored on the service URL can reference stack deployment properties and store the result of those properties when the service is registered.  The deployment properties are referenced using the `@DeploymentProp` tag in the custom property followed by the property to reference.  The available properties that can be referenced are the properties written to the `file` property of the custom `discovery` object declared in the serverless.yml file.

### Example reference:
```yaml
  serviceURL: {
    servicePath: {'@DeploymentProp':'ServiceEndpoint'},
    someLambdaFunctionArn: {'@DeploymentProp':'SomeLambdaFunctionArnLambdaFunctionQualifiedArn'}
  }
```
### Will translate to when stored in the discovery service:
```yaml
  serviceURL: {
    servicePath: "https://APIGatewayID.execute-api.us-east-1.amazonaws.com/dev",
    someLambdaFunctionArn: "arn:aws:lambda:us-east-1:AccountID:function:sls-stack-output-example-dev-example:9"
  }
```

### Authentication
If the service under development is deployed into the same account as the discovery service, `serverless-discovery-plugin` will use the same credentials from AWS environment variables at pipeline run time to authenticate to the discovery service for registration purposes. Otherwise, you can designate explicit credentials that should be used in the configuration.

### Handler

Based on the configuration above the plugin will search for a file `scripts/deploy.js` with the following content:

```js
// async declaration here implicitly returns a Promise<void>
async function handler (data, serverless, options) {
  console.log('Received Stack Output', data)
}

module.exports = { handler }
```

### File Formats

Just name your file with a `.json`, `.toml`, `.yaml`, or `.yml` extension, and the plugin will take care of formatting your output. Please make sure the location where you want to save the file exists!

## License

Feel free to use the code, it's released using the [MIT license](LICENSE.md).

## Contribution

You are more than welcome to contribute to this project! 😘 🙆

To make sure you have a pleasant experience, please read the [code of conduct](CODE_OF_CONDUCT.md). It outlines core values and believes and will make working together a happier experience.

## Example

The plugins works fine with serverless functions, as well as when using custom CloudFormation resources. The following example configuration will deploy an AWS Lambda function, API Gateway, SQS Queue, IAM User with AccessKey and SecretKey, and a static value:

### Serverless.yml

```yaml
service: sls-stack-output-example

plugins:
  - serverless-discovery-plugin

package:
  exclude:
    - node_modules/**

custom:
  discovery:
    discoveryServiceUri: 'https://DiscoveryServiceID.execute-api.us-east-1.amazonaws.com/prod'
    deployHandler: scripts/output.handler
    file: .build/stack.toml

provider:
  name: aws
  runtime: nodejs6.10

functions:
  example:
    handler: functions/example.handle
    events:
      - http:
          path: example
          method: get
          cors: true

resources:
  Resources:
    ExampleQueue:
      Type: AWS::SQS::Queue
      Properties:
        QueueName: example-queue
    ExampleUser:
      Type: "AWS::IAM::User"
      Properties:
        UserName: example-user
        Policies:
          - PolicyName: ExampleUserSQSPolicy
            PolicyDocument:
              Version: '2012-10-17'
              Statement:
                - Effect: "Allow"
                  Action:
                    - sqs:SendMessage
                  Resource:
                    - {"Fn::Join": [":", ["arn:aws:sqs:*", {"Ref": "AWS::AccountId"}, "example-queue"]]}
    ExampleUserKey:
      Type: AWS::IAM::AccessKey
      Properties:
        UserName:
          Ref: ExampleUser
  Outputs:
    ExampleUserKey:
      Value:
        Ref: ExampleUserKey
    ExampleUserSecret:
      Value: {"Fn::GetAtt": ["ExampleUserKey", "SecretAccessKey"]}
    ExampleStaticValue:
      Value: example-static-value
```

### Stack Output

#### Console
```sh
Serverless: Stack update finished...
Service Information
service: sls-stack-output-example
stage: dev
region: us-east-1
stack: sls-stack-output-example-dev
api keys:
  None
endpoints:
  GET - https://APIGatewayID.execute-api.us-east-1.amazonaws.com/dev/example
...
-------------------
Serverless: Registering service endpoint with service: https://DiscoveryServiceID.execute-api.us-east-1.amazonaws.com/prod
Serverless: Stack Output saved to file: test/system/lib/outputs.json
```

#### TOML

```toml
ExampleUserSecret = "YourUserSecretKey"
ExampleUserKey = "YourUserAccessKey"
ExampleLambdaFunctionQualifiedArn = "arn:aws:lambda:us-east-1:AccountID:function:sls-stack-output-example-dev-example:9"
ExampleStaticValue = "example-static-value"
ServiceEndpoint = "https://APIGatewayID.execute-api.us-east-1.amazonaws.com/dev"
ServerlessDeploymentBucketName = "sls-stack-output-example-serverlessdeploymentbuck-BucketID"
```

#### YAML

```yaml
ExampleUserSecret: YourUserSecretKey
ExampleUserKey: YourUserAccessKey
ExampleLambdaFunctionQualifiedArn: 'arn:aws:lambda:us-east-1:AccountID:function:sls-stack-output-example-dev-example:9'
ExampleStaticValue: example-static-value
ServiceEndpoint: 'https://APIGatewayID.execute-api.us-east-1.amazonaws.com/dev'
ServerlessDeploymentBucketName: sls-stack-output-example-serverlessdeploymentbuck-BucketID
```

#### JSON

```json
{
  "ExampleUserSecret": "YourUserSecretKey",
  "ExampleUserKey": "YourUserAccessKey",
  "ExampleLambdaFunctionQualifiedArn": "arn:aws:lambda:us-east-1:AccountID:function:sls-stack-output-example-dev-example:9",
  "ExampleStaticValue": "example-static-value",
  "ServiceEndpoint": "https://APIGatewayID.execute-api.us-east-1.amazonaws.com/dev",
  "ServerlessDeploymentBucketName": "sls-stack-output-example-serverlessdeploymentbuck-BucketID"
}
```
