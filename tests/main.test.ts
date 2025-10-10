import { retry } from "../src/retry";

describe("retry tests", () => {
  it("should call on try and return result ", async () => {
    const onTry = jest.fn((ok: string) => {
      return ok;
    });
    const res = await retry(() => onTry("ok"));

    expect(res.ok).toBe(true);
    expect(onTry).toHaveBeenCalledTimes(1);
    expect(onTry).toHaveBeenCalledWith("ok");
  });

  it("should try tries # of times if throws every time", async () => {
    const TRIES = 10;

    const onTry = jest.fn((att: number) => {
      throw new Error("error");
    });

    const res = await retry((att) => onTry(att), { tries: TRIES });

    expect(res.ok).toBe(false);

    expect(onTry).toHaveBeenCalledTimes(TRIES);

    Array(TRIES)
      .fill(0)
      .forEach((_, i) => expect(onTry).toHaveBeenCalledWith(i + 1));
  });

  it("should try tries # of times and call onCatch if throws", async () => {
    const TRIES = 10;
    const ON_TRY_ERROR = new Error("error");

    const onTry = jest.fn((att: number) => {
      throw ON_TRY_ERROR;
    });
    const onCatch = jest.fn((error, att) => {
      return "failed";
    });

    const res = await retry((att) => onTry(att), { tries: TRIES, onCatch });

    expect(res.ok).toBe(false);

    Array(TRIES)
      .fill(0)
      .forEach((_, i) =>
        expect(onCatch).toHaveBeenCalledWith(ON_TRY_ERROR, i + 1)
      );
  });

  it("should fail if throws on every attempt", async () => {
    const ON_TRY_ERROR = new Error("error");
    const onTry = jest.fn((att: number) => {
      throw ON_TRY_ERROR;
    });
    const onFail = jest.fn((errors, attempt) => {
      return "failed";
    });

    const res = await retry((att) => onTry(att), { onFail });

    expect(res.ok).toBe(false);
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(onFail).toHaveBeenCalledWith(Array(5).fill(ON_TRY_ERROR), 5);
  });
});
