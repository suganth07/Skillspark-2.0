declare module "svd-js" {
  interface SVDResult {
    u: number[][];
    v: number[][];
    q: number[];
  }

  export function SVD(matrix: number[][]): SVDResult;
}
