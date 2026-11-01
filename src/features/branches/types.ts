export type Branch = {
  id: number
  name: string
  isMain: boolean
  isActive: boolean
  tableCount: number
  roomCount: number
}

export type BranchInput = { name: string }
export type BranchChanges = { name?: string; isActive?: boolean }
