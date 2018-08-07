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
  // TODO: IAM credentials
  deployHandler: string
  removeHandler: string
  file: string
}