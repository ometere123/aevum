import { z } from "zod";

const address=z.string().regex(/^0x[0-9a-fA-F]{40}$/,"Enter a valid 0x address");
const genAmount=z.string().trim().regex(/^\d+(?:\.\d{1,18})?$/,"Enter a valid GEN amount with at most 18 decimals");

export const charterSchema=z.object({
  name:z.string().trim().min(3).max(80),
  mission:z.string().trim().min(20).max(1200),
  successionCriteria:z.string().trim().min(20).max(1200),
  reviewInterval:z.coerce.number().int().min(60).max(31536000),
  dormancyThreshold:z.coerce.number().int().min(60).max(31536000),
  epochSeconds:z.coerce.number().int().min(3600).max(31536000),
  releaseCapGen:genAmount,
  recoveryRecipient:address,
  closureDelay:z.coerce.number().int().min(60).max(31536000),
});

export const sourceSchema=z.object({
  label:z.string().trim().min(2).max(80),
  url:z.string().url().max(512).refine(u=>u.startsWith("https://"),"Source must use HTTPS").refine(u=>!/[#?].*(password|token|secret|apikey)=/i.test(u),"Credential-bearing URLs are not allowed"),
  purpose:z.enum(["repo","official_site","governance","activity_feed"]),
});

export const releaseSchema=z.object({
  recipient:address,
  amountGen:genAmount,
  memo:z.string().trim().min(1).max(240),
});

export const depositSchema=z.object({amountGen:genAmount});
