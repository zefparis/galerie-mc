declare module 'pg' {
  export class Pool {
    constructor(config?: {
      connectionString?: string
      ssl?: { rejectUnauthorized?: boolean } | boolean
    })
    query(text: string, values?: any[]): Promise<{ rows: any[]; rowCount: number }>
    end(): Promise<void>
  }
}
