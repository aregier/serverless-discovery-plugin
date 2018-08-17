declare interface StackOutputPair {
  OutputKey: string
  OutputValue: string
}

declare interface StackDescription {
  Outputs: StackOutputPair[]
}

declare interface StackDescriptionList {
  Stacks: StackDescription[]
}

declare interface DiscoveryConfig {
  discoveryServiceUri: string
  accessKeyId?: string
  secretAccessKey?: string
  deployHandler: string
  removeHandler: string
  file: string
}