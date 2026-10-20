// Binary gigabytes, so device RAM reads as the size it is sold with (an "8 GB"
// phone reports 8 × 1024³ bytes). The catalogue's sizeGB is decimal (10⁹
// bytes, like Hugging Face), so comparing the two overstates a model by ~7%:
// it can only make a model look too big, never too small.
export const BYTES_PER_GB = 1024 ** 3;
