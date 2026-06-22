import type { Contact } from '@crm/shared';

export const OPTIONAL_CONTACT_FIELDS: { key: keyof Contact; label: string }[] = [
  { key: 'family', label: '家族構成' },
  { key: 'usage', label: '用途' },
  { key: 'budget', label: '予算' },
  { key: 'desired_equipment', label: '希望装備' },
  { key: 'rival_car', label: '競合車' },
  { key: 'insurance_status', label: '保険状況' },
];
