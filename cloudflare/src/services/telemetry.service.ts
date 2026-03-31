export const telemetryService = {
  async stats(): Promise<Record<string, number>> {
    return { runs: 0 };
  },
};

export default telemetryService;
