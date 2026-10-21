import * as z from 'zod';
import { memberInputSchema, type Member, type MemberInput } from '@/lib/contract/member';

/**
 * The form follows the contract, so both sides agree on every rule and message. The one difference
 * is the company: a text field holds a string, the API takes `null` for "no company".
 */
export const memberFormSchema = memberInputSchema.extend({
  company: z.string().trim().max(80),
});

export type MemberFormValues = z.infer<typeof memberFormSchema>;

export const MEMBER_FORM_DEFAULTS: MemberFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  company: '',
  plan: 'flex',
  status: 'active',
};

/** Field names a 422 can point at. */
export const MEMBER_FORM_FIELDS = Object.keys(MEMBER_FORM_DEFAULTS) as Array<
  keyof MemberFormValues
>;

/** Form values of a member being edited; defaults for a new one. */
export const toFormValues = (member?: Member): MemberFormValues =>
  member
    ? {
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        phone: member.phone,
        company: member.company ?? '',
        plan: member.plan,
        status: member.status,
      }
    : MEMBER_FORM_DEFAULTS;

/** The request body for the values of the form: a blank company goes as `null`. */
export const toMemberInput = (values: MemberFormValues): MemberInput => ({
  ...values,
  company: values.company === '' ? null : values.company,
});
