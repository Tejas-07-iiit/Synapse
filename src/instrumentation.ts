export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { bootstrapMCX } = await import('./mcx/bootstrap');
        await bootstrapMCX();
    }
}
