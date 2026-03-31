export const authService = {
  async login(): Promise<Record<string, string>> {
    return { message: "TODO: implement Cloudflare auth login" };
  },
  async callback(): Promise<Record<string, string>> {
    return { message: "TODO: implement Cloudflare auth callback" };
  },
};

export default authService;
