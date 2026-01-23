-- OTP Storage for PIN Reset
-- This table stores temporary OTP codes for PIN reset verification

CREATE TABLE IF NOT EXISTS public.otp_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    used BOOLEAN DEFAULT FALSE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_otp_phone ON public.otp_codes(phone);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON public.otp_codes(expires_at);

-- Auto-delete expired OTPs (optional cleanup)
-- You can run this periodically or use a cron job
-- DELETE FROM public.otp_codes WHERE expires_at < NOW() AND used = TRUE;
