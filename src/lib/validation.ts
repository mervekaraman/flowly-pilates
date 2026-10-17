import { z } from "zod";

/**
 * A person's name, as it appears in e-mails the studio sends and on trainers' screens: letters
 * (any language), spaces, apostrophes and hyphens only, so nobody can put links, phone
 * numbers or other text into mail signed by the studio.
 */
export const personName = z.string()
  .transform((value) => value.normalize("NFC").replace(/\s+/gu, " ").trim())
  .pipe(z.string()
    .min(2, { error: "Adını ve soyadını yaz." })
    .max(80, { error: "Ad soyad en fazla 80 karakter olabilir." })
    .regex(/^[\p{L}\p{M}][\p{L}\p{M} '’-]*$/u, { error: "Ad soyad yalnızca harf, boşluk, kesme işareti ve tire içerebilir." }));
