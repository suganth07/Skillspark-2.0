declare module "svd-js" {
  interface SVDResult {
    u: number[][];
    v: number[][];
    q: number[];
  }

  export function SVD(
    matrix: number[][], 
    withu?: boolean, 
    withv?: boolean, 
    eps?: number, 
    tol?: number
  ): SVDResult;
}
