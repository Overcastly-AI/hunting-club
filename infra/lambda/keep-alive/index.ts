// Daily Supabase keep-alive (EventBridge Scheduler). STUB until a Supabase project exists:
// with SUPABASE_URL unset it logs and exits. Then it will make one cheap authenticated
// request so the free project doesn't pause after a week idle.

export const handler = async (): Promise<{ status: 'skipped' | 'pending' }> => {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    console.log(JSON.stringify({ msg: 'keep-alive skipped: no Supabase project configured' }));
    return { status: 'skipped' };
  }
  // Milestone 8/9: call a lightweight endpoint (e.g. a health RPC) with the project key.
  console.log(JSON.stringify({ msg: 'keep-alive not implemented yet', url }));
  return { status: 'pending' };
};
