// Pure timer math. Timers are stored as absolute end timestamps so they stay correct
// when the phone locks or the app is backgrounded/reloaded.
export const remainingSec = (state, now = Date.now()) =>
  state ? Math.max(0, Math.ceil((state.endsAt - now) / 1000)) : 0;

export function adjustEnd(state, deltaSec, now = Date.now()) {
  const endsAt = Math.max(now, state.endsAt + deltaSec * 1000);
  return { endsAt, total: Math.max(0, state.total + deltaSec) };
}
