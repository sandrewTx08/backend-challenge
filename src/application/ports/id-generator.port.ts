export interface IdGenerator {
  generate(): string;
}

export interface IdGeneratorPort extends IdGenerator {}
