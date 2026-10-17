jest.mock("@kubernetes/client-node", () => ({
  BatchV1Api: class BatchV1Api {},
  CoreV1Api: class CoreV1Api {},
  KubeConfig: class KubeConfig {
    loadFromDefault() {}
    makeApiClient(ctor: new () => unknown) {
      return new ctor();
    }
  },
  Exec: class Exec {},
}));

import { GameStreamerService } from "./game-streamer.service";

// Golden Job specs for the six game-streamer modes. The .snap file was
// written on unchanged main code, so any change to the Job that an NVIDIA
// node gets shows up here as a snapshot diff.

type Mode =
  | "live"
  | "create-clips"
  | "demo"
  | "batch-highlights"
  | "nade-previews"
  | "warm-shaders";

type GoldenInputs = {
  jobName: string;
  matchId: string;
  nodeId: string;
  extraEnv: Array<{ name: string; value: string }>;
  extraLabels: Record<string, string>;
};

const STEAM_ACCOUNT = {
  id: "sa-golden",
  username: "golden-bot",
  password: "golden-pw",
};

const INPUTS: Record<Mode, GoldenInputs> = {
  live: {
    jobName: "gs-live-match-golden",
    matchId: "match-golden",
    nodeId: "node-golden",
    extraEnv: [{ name: "CONNECT_ADDR", value: "10.0.0.5:27015" }],
    extraLabels: {},
  },
  "create-clips": {
    jobName: "gs-clips-match-golden",
    matchId: "match-golden",
    nodeId: "node-golden",
    extraEnv: [{ name: "CLIP_JOB_ID", value: "clip-golden" }],
    extraLabels: {},
  },
  demo: {
    jobName: "gs-demo-sessiongolde",
    matchId: "match-golden",
    nodeId: "node-golden",
    extraEnv: [{ name: "DEMO_SESSION_ID", value: "session-golden" }],
    extraLabels: { "session-id": "session-golden" },
  },
  "batch-highlights": {
    jobName: "gs-batch-mapgolde-demogold",
    matchId: "match-golden",
    nodeId: "node-golden",
    extraEnv: [{ name: "BATCH_MATCH_MAP_ID", value: "map-golden" }],
    extraLabels: {
      "match-map-id": "map-golden",
      "match-map-demo-id": "demo-golden",
    },
  },
  "nade-previews": {
    jobName: "gs-nades-demirage",
    matchId: "match-golden",
    nodeId: "node-golden",
    extraEnv: [{ name: "NADE_BATCH_MODE", value: "1" }],
    extraLabels: { "utility-map": "de_mirage" },
  },
  // The same inputs bakeShaders passes for node-golden when the node has no
  // cs2_video_settings, so the bake test can compare against this golden.
  "warm-shaders": {
    jobName: "shader-bake-node-golden",
    matchId: "node-golden",
    nodeId: "node-golden",
    extraEnv: [
      { name: "BAKE_NODE_ID", value: "node-golden" },
      { name: "CS2_VIDEO_SETTINGS", value: "{}" },
    ],
    extraLabels: { "node-id": "node-golden" },
  },
};

const MODES = Object.keys(INPUTS) as Mode[];

describe("GameStreamerService Job spec goldens", () => {
  let service: GameStreamerService;

  const config = {
    get: (key: string) => {
      if (key === "gameServers") {
        return {
          namespace: "test",
          gameStreamerImage: "5stack/game-streamer:golden",
        };
      }
      if (key === "app") {
        return { encSecret: "job-spec-fixture" };
      }
      if (key === "steam") {
        return { steamUser: "config-bot", steamPassword: "config-pw" };
      }
      return {} as any;
    },
  };

  const build = (mode: Mode) => {
    const input = INPUTS[mode];
    return service["buildJobSpec"](
      input.jobName,
      input.matchId,
      mode,
      input.nodeId,
      input.extraEnv,
      input.extraLabels,
      STEAM_ACCOUNT,
    );
  };

  beforeEach(() => {
    delete process.env.API_INTERNAL_BASE;
    delete process.env.GAME_STREAM_DOMAIN;
    delete process.env.DEBUG_STREAM;

    service = new GameStreamerService(
      { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as any,
      config as any,
      { query: jest.fn(), mutation: jest.fn() } as any,
      { query: jest.fn(), transaction: jest.fn() } as any,
      { getConnection: jest.fn() } as any,
      {} as any,
      {} as any,
      { claim: jest.fn(), release: jest.fn() } as any,
      { resolveDefault: jest.fn().mockResolvedValue(null) } as any,
    );
  });

  it.each(MODES)("%s", (mode) => {
    expect(build(mode)).toMatchSnapshot();
  });
});
