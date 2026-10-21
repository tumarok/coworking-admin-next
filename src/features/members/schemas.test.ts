import { describe, expect, it } from 'vitest';
import { memberInputSchema, type Member } from '@/lib/contract/member';
import {
  MEMBER_FORM_DEFAULTS,
  MEMBER_FORM_FIELDS,
  memberFormSchema,
  toFormValues,
  toMemberInput,
} from './schemas';

const MEMBER: Member = {
  id: 'mem_1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phone: '+380 44 123 45 67',
  company: 'Analytical Engines',
  plan: 'dedicated',
  status: 'suspended',
  joinedAt: '2026-01-31',
};

const messages = (value: unknown) =>
  Object.fromEntries(
    (memberFormSchema.safeParse(value).error?.issues ?? []).map((issue) => [
      issue.path.join('.'),
      issue.message,
    ]),
  );

describe('toFormValues', () => {
  it('uses the defaults for a new member', () => {
    expect(toFormValues()).toEqual(MEMBER_FORM_DEFAULTS);
    expect(MEMBER_FORM_DEFAULTS).toMatchObject({ plan: 'flex', status: 'active', company: '' });
  });

  it('takes the editable fields of an existing member and leaves the server fields out', () => {
    expect(toFormValues(MEMBER)).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '+380 44 123 45 67',
      company: 'Analytical Engines',
      plan: 'dedicated',
      status: 'suspended',
    });
  });

  it('shows a missing company as an empty text field', () => {
    expect(toFormValues({ ...MEMBER, company: null }).company).toBe('');
  });

  it('produces values the form schema accepts', () => {
    expect(memberFormSchema.safeParse(toFormValues(MEMBER)).success).toBe(true);
    expect(memberFormSchema.safeParse(toFormValues({ ...MEMBER, company: null })).success).toBe(
      true,
    );
  });
});

describe('toMemberInput', () => {
  it('sends a blank company as null and a typed one as it is', () => {
    expect(toMemberInput({ ...toFormValues(MEMBER), company: '' }).company).toBeNull();
    expect(toMemberInput(toFormValues(MEMBER)).company).toBe('Analytical Engines');
  });

  it('gives the API a body its own schema accepts', () => {
    expect(memberInputSchema.safeParse(toMemberInput(toFormValues(MEMBER))).success).toBe(true);
    expect(memberInputSchema.safeParse(toMemberInput({ ...MEMBER, company: '' })).success).toBe(
      true,
    );
  });

  it('round-trips a member through the form', () => {
    const { id: _id, joinedAt: _joinedAt, ...input } = MEMBER;

    expect(toMemberInput(toFormValues(MEMBER))).toEqual(input);
    expect(toMemberInput(toFormValues({ ...MEMBER, company: null }))).toEqual({
      ...input,
      company: null,
    });
  });
});

describe('memberFormSchema', () => {
  const valid = toFormValues(MEMBER);

  it('follows the rules and messages of the contract', () => {
    expect(
      messages({ ...valid, firstName: ' ', lastName: '', email: 'ada', phone: 'call me' }),
    ).toEqual({
      firstName: 'Required',
      lastName: 'Required',
      email: 'Enter a valid email',
      phone: 'Enter a valid phone number',
    });
  });

  it('trims the email and lowers its case, so the API sees what it stores', () => {
    const parsed = memberFormSchema.parse({ ...valid, email: '  Ada@Example.COM ' });

    expect(parsed.email).toBe('ada@example.com');
  });

  it('trims the company and caps it at 80 characters', () => {
    expect(memberFormSchema.parse({ ...valid, company: '  Acme  ' }).company).toBe('Acme');
    expect(Object.keys(messages({ ...valid, company: 'c'.repeat(81) }))).toEqual(['company']);
  });
});

describe('MEMBER_FORM_FIELDS', () => {
  it('lists every field of the form', () => {
    expect(MEMBER_FORM_FIELDS.toSorted()).toEqual(
      ['company', 'email', 'firstName', 'lastName', 'phone', 'plan', 'status'].toSorted(),
    );
  });
});
