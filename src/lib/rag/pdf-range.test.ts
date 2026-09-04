import { afterEach, describe, expect, it, vi } from "vitest";
import { openRemotePdf, RangeNotSupportedError } from "./pdf-range.server";

describe("leitura remota de PDF por faixa", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("recusa resposta 200 antes de materializar o arquivo inteiro", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-length": String(250 * 1024 * 1024) },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      openRemotePdf("https://storage.example/processo.pdf", 250 * 1024 * 1024),
    ).rejects.toBeInstanceOf(RangeNotSupportedError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
