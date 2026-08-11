ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "sex" VARCHAR(1);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_sex_check'
  ) THEN
    ALTER TABLE "User"
    ADD CONSTRAINT "User_sex_check"
    CHECK ("sex" IS NULL OR "sex" IN ('M', 'F'));
  END IF;
END
$$;
