import { z } from 'zod'
export const invitationSchema = z.object({
  displayName: z.string().trim().min(1, 'Enter the Officer’s name.').max(100),
  email: z.email('Enter a valid email address.').trim().max(254),
  departmentId: z.uuid('Choose a department.'),
})
export type OfficerInvitation = z.infer<typeof invitationSchema>
