import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ufangisetwobnygcqchr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Dpj9cx807CnsqnKnUez9kg_eWgZ4BDY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
