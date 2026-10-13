declare module 'pg' {
  export class Pool {
    constructor(config?: {
      connectionString?: string
      ssl?: { rejectUnauthorized?: boolean; ca?: string } | boolean
      max?: number
      idleTimeoutMillis?: number
      connectionTimeoutMillis?: number
    })
    query(text: string, values?: any[]): Promise<{ rows: any[]; rowCount: number }>
    connect(): Promise<PoolClient>
    end(): Promise<void>
  }

  export interface PoolClient {
    query(text: string, values?: any[]): Promise<{ rows: any[]; rowCount: number }>
    release(): void
  }
}
