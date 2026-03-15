// Supabase Edge Function: resolve-disputes
// Checks for stale disputes (open > 48h with incomplete votes) and auto-resolves them
// Schedule: daily via pg_cron or call manually

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find open disputes older than 48 hours
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: staleDisputes, error: fetchError } = await supabase
      .from('disputes')
      .select('*')
      .eq('status', 'open')
      .lt('created_at', cutoff);

    if (fetchError) {
      console.error('Error fetching stale disputes:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let resolved = 0;

    for (const dispute of staleDisputes ?? []) {
      const votes = dispute.jury_votes as Record<string, string>;
      const voteCount = Object.keys(votes).length;

      // If we have at least 1 vote, resolve based on existing votes
      // If no votes at all, return to poster (default)
      if (voteCount < 3) {
        let approveCount = 0;
        let returnCount = 0;
        let splitCount = 0;

        for (const v of Object.values(votes)) {
          if (v === 'approve_worker') approveCount++;
          else if (v === 'return_poster') returnCount++;
          else if (v === 'split') splitCount++;
        }

        // Determine resolution based on available votes (or default to return_poster)
        let resolution = 'return_poster';
        if (approveCount > returnCount && approveCount > splitCount) {
          resolution = 'approve_worker';
        } else if (splitCount > returnCount && splitCount > approveCount) {
          resolution = 'split';
        }

        // Use the cast_jury_vote mechanism won't work here since we need admin resolution
        // Instead, directly resolve via SQL
        const { data: task } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', dispute.task_id)
          .single();

        if (!task) continue;

        if (resolution === 'approve_worker' && task.worker_id) {
          // Release bounty to worker
          const { data: workerWallet } = await supabase
            .from('wallets')
            .select('id, balance')
            .eq('user_id', task.worker_id)
            .single();

          if (workerWallet) {
            await supabase
              .from('wallets')
              .update({
                balance: Math.min(workerWallet.balance + task.bounty_amount, 10000),
                lifetime_earned: workerWallet.balance + task.bounty_amount,
              })
              .eq('id', workerWallet.id);

            await supabase.from('transactions').insert({
              to_wallet_id: workerWallet.id,
              amount: task.bounty_amount,
              type: 'escrow',
              description: 'Dispute auto-resolved: bounty released to worker',
            });
          }
          await supabase.from('tasks').update({ status: 'approved' }).eq('id', task.id);

        } else if (resolution === 'split' && task.worker_id) {
          const half = Math.round(task.bounty_amount / 2 * 100) / 100;
          const otherHalf = task.bounty_amount - half;

          const { data: workerWallet } = await supabase
            .from('wallets').select('id, balance').eq('user_id', task.worker_id).single();
          const { data: posterWallet } = await supabase
            .from('wallets').select('id, balance').eq('user_id', task.poster_id).single();

          if (workerWallet) {
            await supabase.from('wallets').update({
              balance: Math.min(workerWallet.balance + half, 10000),
              lifetime_earned: workerWallet.balance + half,
            }).eq('id', workerWallet.id);
            await supabase.from('transactions').insert({
              to_wallet_id: workerWallet.id, amount: half, type: 'escrow',
              description: 'Dispute auto-resolved: split - worker share',
            });
          }
          if (posterWallet) {
            await supabase.from('wallets').update({
              balance: posterWallet.balance + otherHalf,
            }).eq('id', posterWallet.id);
            await supabase.from('transactions').insert({
              to_wallet_id: posterWallet.id, amount: otherHalf, type: 'escrow',
              description: 'Dispute auto-resolved: split - poster share',
            });
          }
          await supabase.from('tasks').update({ status: 'cancelled' }).eq('id', task.id);

        } else {
          // Return to poster (default)
          const { data: posterWallet } = await supabase
            .from('wallets').select('id, balance').eq('user_id', task.poster_id).single();

          if (posterWallet) {
            await supabase.from('wallets').update({
              balance: posterWallet.balance + task.bounty_amount,
            }).eq('id', posterWallet.id);
            await supabase.from('transactions').insert({
              to_wallet_id: posterWallet.id, amount: task.bounty_amount, type: 'escrow',
              description: 'Dispute auto-resolved: bounty returned to poster',
            });
          }
          await supabase.from('tasks').update({ status: 'cancelled' }).eq('id', task.id);
        }

        await supabase.from('disputes').update({
          status: 'resolved',
          resolution: resolution + ' (auto)',
        }).eq('id', dispute.id);

        resolved++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Resolved ${resolved} stale dispute(s)`,
        total_checked: (staleDisputes ?? []).length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
