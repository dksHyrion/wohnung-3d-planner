import type { de } from './locales/de';

export type Language = 'de' | 'en';

/** Shape of every dictionary, derived from the German one. A new key goes into de.ts first. */
export type TranslationSchema = typeof de;

export type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`;
}[keyof ObjectType & (string | number)];

export type TranslationKey = NestedKeyOf<TranslationSchema>;

