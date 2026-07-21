/**
 * Optimal 1D quantization using dynamic programming on a histogram.
 *
 * Pools all columns into a single 1D dataset, sorts the values, bins them
 * using a blend of uniform and quantile positioning, then uses DP to find k
 * centroids that minimize weighted sum-of-squared-errors (SSE).
 *
 * Bin positions are an adaptive blend of uniform (value-space) and
 * quantile (rank-space) positioning. The blend ratio is computed from
 * the data's IQR-to-range ratio: extreme outlier distributions (small
 * IQR relative to range) use near-pure quantile to give the dense
 * center adequate bins, while moderate-tail distributions reduce
 * quantile bias (but keep at least 50% quantile weighting).
 *
 * Bin weights use sub-linear density weighting: weight = count^alpha.
 * With alpha < 1, sparse tail regions earn meaningful influence on
 * centroid placement.
 *
 * @param columns - Named columns pooled into 1D.
 * @param k - Number of codebook entries (default 256).
 * @param alpha - Density weight exponent. 0 = uniform (each bin equal),
 * 0.5 = sqrt (balanced), 1.0 = standard MSE (dense regions dominate).
 * Default 0.5.
 * @returns Object with `centroids` (k Float32 values, sorted ascending) and
 * `labels` (same column layout as input, each holding Uint8Array indices
 * into the codebook).
 */
const quantize1dColumns = (columns, k = 256, alpha = 0.5) => {
    const numColumns = columns.length;
    const numRows = numColumns > 0 ? columns[0].data.length : 0;
    // pool all columns into a flat 1D array
    const N = numRows * numColumns;
    if (N === 0) {
        return {
            centroids: new Float32Array(k),
            labels: columns.map(c => ({ name: c.name, data: new Uint8Array(numRows) }))
        };
    }
    const data = new Float32Array(N);
    for (let i = 0; i < numColumns; ++i) {
        data.set(columns[i].data, i * numRows);
    }
    // sort a copy for histogram binning (keep original for label assignment)
    const sortedData = new Float32Array(data);
    sortedData.sort();
    const vMin = sortedData[0];
    const vMax = sortedData[N - 1];
    // handle degenerate case where all values are identical
    if (vMax - vMin < 1e-20) {
        const centroids = new Float32Array(k);
        centroids.fill(vMin);
        return {
            centroids,
            labels: columns.map(c => ({ name: c.name, data: new Uint8Array(numRows) }))
        };
    }
    // build histogram using blended uniform/quantile bin positions
    const H = Math.min(1024, N);
    const vRange = vMax - vMin;
    // adaptive blend ratio: when outliers are extreme (IQR << range), lean
    // strongly toward quantile to give the dense center adequate bins; when
    // the distribution has moderate tails (IQR ~ range), reduce quantile
    // bias somewhat, but keep at least 50% quantile to preserve density
    const iqr = sortedData[Math.floor(N * 0.75)] - sortedData[Math.floor(N * 0.25)];
    const beta = Math.max(0.5, Math.min(0.999, 1 - iqr / vRange));
    const counts = new Float64Array(H);
    const sums = new Float64Array(H);
    for (let i = 0; i < N; ++i) {
        const uniformPos = (sortedData[i] - vMin) / vRange;
        const quantilePos = i / N;
        const bin = Math.min(H - 1, Math.floor(H * (beta * quantilePos + (1 - beta) * uniformPos)));
        counts[bin]++;
        sums[bin] += sortedData[i];
    }
    const centers = new Float64Array(H);
    for (let i = 0; i < H; ++i) {
        centers[i] = counts[i] > 0 ? sums[i] / counts[i] : vMin + (i + 0.5) / H * vRange;
    }
    // compute weights: w = count^alpha (sub-linear density weighting)
    const weights = new Float64Array(H);
    for (let i = 0; i < H; ++i) {
        weights[i] = counts[i] > 0 ? Math.pow(counts[i], alpha) : 0;
    }
    // prefix sums for O(1) range cost queries
    //   cost(a,b) = sum_wxx - sum_wx^2 / sum_w
    //   centroid(a,b) = sum_wx / sum_w
    const prefW = new Float64Array(H + 1);
    const prefWX = new Float64Array(H + 1);
    const prefWXX = new Float64Array(H + 1);
    for (let i = 0; i < H; ++i) {
        prefW[i + 1] = prefW[i] + weights[i];
        prefWX[i + 1] = prefWX[i] + weights[i] * centers[i];
        prefWXX[i + 1] = prefWXX[i] + weights[i] * centers[i] * centers[i];
    }
    const rangeCost = (a, b) => {
        const w = prefW[b + 1] - prefW[a];
        if (w <= 0)
            return 0;
        const wx = prefWX[b + 1] - prefWX[a];
        const wxx = prefWXX[b + 1] - prefWXX[a];
        return wxx - (wx * wx) / w;
    };
    const rangeMean = (a, b) => {
        const w = prefW[b + 1] - prefW[a];
        if (w <= 0)
            return (centers[a] + centers[b]) * 0.5;
        return (prefWX[b + 1] - prefWX[a]) / w;
    };
    const nonEmpty = counts.reduce((n, c) => n + (c > 0 ? 1 : 0), 0);
    const effectiveK = Math.min(k, nonEmpty);
    // DP: dp[m][j] = min weighted SSE of quantizing bins 0..j into m centroids
    // Use two rows to save memory (only need previous row)
    const INF = 1e30;
    let dpPrev = new Float64Array(H).fill(INF);
    let dpCurr = new Float64Array(H).fill(INF);
    const splitTable = new Array(effectiveK + 1);
    // base case: m = 1
    const split1 = new Int32Array(H);
    for (let j = 0; j < H; ++j) {
        dpPrev[j] = rangeCost(0, j);
        split1[j] = -1;
    }
    splitTable[1] = split1;
    // fill DP for m = 2..effectiveK
    for (let m = 2; m <= effectiveK; ++m) {
        dpCurr.fill(INF);
        const splitM = new Int32Array(H);
        for (let j = m - 1; j < H; ++j) {
            let bestCost = INF;
            let bestS = m - 2;
            for (let s = m - 2; s < j; ++s) {
                const cost = dpPrev[s] + rangeCost(s + 1, j);
                if (cost < bestCost) {
                    bestCost = cost;
                    bestS = s;
                }
            }
            dpCurr[j] = bestCost;
            splitM[j] = bestS;
        }
        splitTable[m] = splitM;
        // swap rows
        const tmp = dpPrev;
        dpPrev = dpCurr;
        dpCurr = tmp;
    }
    // backtrack to find centroid values
    const centroidValues = new Float32Array(effectiveK);
    let j = H - 1;
    for (let m = effectiveK; m >= 1; --m) {
        const s = m > 1 ? splitTable[m][j] : -1;
        centroidValues[m - 1] = rangeMean(s + 1, j);
        j = s;
    }
    // sort centroids (should already be sorted, but ensure)
    centroidValues.sort();
    // pad to k entries if effectiveK < k (duplicate last centroid)
    const finalCentroids = new Float32Array(k);
    finalCentroids.set(centroidValues);
    for (let i = effectiveK; i < k; ++i) {
        finalCentroids[i] = centroidValues[effectiveK - 1];
    }
    // assign each data point to nearest centroid via binary search
    const labels = new Uint8Array(N);
    for (let i = 0; i < N; ++i) {
        const v = data[i];
        // binary search for nearest centroid
        let lo = 0;
        let hi = k - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            // compare against midpoint between centroids mid and mid+1
            if (v < (finalCentroids[mid] + finalCentroids[mid + 1]) * 0.5) {
                hi = mid;
            }
            else {
                lo = mid + 1;
            }
        }
        labels[i] = lo;
    }
    return {
        centroids: finalCentroids,
        labels: columns.map((c, i) => ({
            name: c.name,
            data: labels.slice(i * numRows, (i + 1) * numRows)
        }))
    };
};

var Module = (() => {
  
  return (
async function(moduleArg = {}) {
  var moduleRtn;

var Module=moduleArg;var readyPromiseResolve,readyPromiseReject;var readyPromise=new Promise((resolve,reject)=>{readyPromiseResolve=resolve;readyPromiseReject=reject;});var ENVIRONMENT_IS_WEB=typeof window=="object";var ENVIRONMENT_IS_WORKER=typeof WorkerGlobalScope!="undefined";var ENVIRONMENT_IS_NODE=typeof process=="object"&&process.versions?.node&&process.type!="renderer";if(ENVIRONMENT_IS_NODE){const{createRequire}=await import('module');var require=createRequire(import.meta.url);}var _scriptName=import.meta.url;var scriptDirectory="";function locateFile(path){if(Module["locateFile"]){return Module["locateFile"](path,scriptDirectory)}return scriptDirectory+path}var readAsync,readBinary;if(ENVIRONMENT_IS_NODE){var fs=require("fs");var nodePath=require("path");if(_scriptName.startsWith("file:")){scriptDirectory=nodePath.dirname(require("url").fileURLToPath(_scriptName))+"/";}readBinary=filename=>{filename=isFileURI(filename)?new URL(filename):filename;var ret=fs.readFileSync(filename);return ret};readAsync=async(filename,binary=true)=>{filename=isFileURI(filename)?new URL(filename):filename;var ret=fs.readFileSync(filename,binary?undefined:"utf8");return ret};if(process.argv.length>1){process.argv[1].replace(/\\/g,"/");}process.argv.slice(2);}else if(ENVIRONMENT_IS_WEB||ENVIRONMENT_IS_WORKER){try{scriptDirectory=new URL(".",_scriptName).href;}catch{}{if(ENVIRONMENT_IS_WORKER){readBinary=url=>{var xhr=new XMLHttpRequest;xhr.open("GET",url,false);xhr.responseType="arraybuffer";xhr.send(null);return new Uint8Array(xhr.response)};}readAsync=async url=>{var response=await fetch(url,{credentials:"same-origin"});if(response.ok){return response.arrayBuffer()}throw new Error(response.status+" : "+response.url)};}}else;console.log.bind(console);var err=console.error.bind(console);var wasmBinary;var wasmMemory;var ABORT=false;var HEAP8,HEAPU8;var isFileURI=filename=>filename.startsWith("file://");function updateMemoryViews(){var b=wasmMemory.buffer;HEAP8=new Int8Array(b);Module["HEAPU8"]=HEAPU8=new Uint8Array(b);Module["HEAPU32"]=new Uint32Array(b);new BigInt64Array(b);new BigUint64Array(b);}function preRun(){if(Module["preRun"]){if(typeof Module["preRun"]=="function")Module["preRun"]=[Module["preRun"]];while(Module["preRun"].length){addOnPreRun(Module["preRun"].shift());}}callRuntimeCallbacks(onPreRuns);}function initRuntime(){wasmExports["c"]();}function postRun(){if(Module["postRun"]){if(typeof Module["postRun"]=="function")Module["postRun"]=[Module["postRun"]];while(Module["postRun"].length){addOnPostRun(Module["postRun"].shift());}}callRuntimeCallbacks(onPostRuns);}var runDependencies=0;var dependenciesFulfilled=null;function addRunDependency(id){runDependencies++;Module["monitorRunDependencies"]?.(runDependencies);}function removeRunDependency(id){runDependencies--;Module["monitorRunDependencies"]?.(runDependencies);if(runDependencies==0){if(dependenciesFulfilled){var callback=dependenciesFulfilled;dependenciesFulfilled=null;callback();}}}function abort(what){Module["onAbort"]?.(what);what="Aborted("+what+")";err(what);ABORT=true;what+=". Build with -sASSERTIONS for more info.";var e=new WebAssembly.RuntimeError(what);readyPromiseReject(e);throw e}var wasmBinaryFile;function findWasmBinary(){if(Module["locateFile"]){return locateFile("webp.wasm")}return new URL("webp.wasm",import.meta.url).href}function getBinarySync(file){if(file==wasmBinaryFile&&wasmBinary){return new Uint8Array(wasmBinary)}if(readBinary){return readBinary(file)}throw "both async and sync fetching of the wasm failed"}async function getWasmBinary(binaryFile){if(!wasmBinary){try{var response=await readAsync(binaryFile);return new Uint8Array(response)}catch{}}return getBinarySync(binaryFile)}async function instantiateArrayBuffer(binaryFile,imports){try{var binary=await getWasmBinary(binaryFile);var instance=await WebAssembly.instantiate(binary,imports);return instance}catch(reason){err(`failed to asynchronously prepare wasm: ${reason}`);abort(reason);}}async function instantiateAsync(binary,binaryFile,imports){if(!binary&&typeof WebAssembly.instantiateStreaming=="function"&&!ENVIRONMENT_IS_NODE){try{var response=fetch(binaryFile,{credentials:"same-origin"});var instantiationResult=await WebAssembly.instantiateStreaming(response,imports);return instantiationResult}catch(reason){err(`wasm streaming compile failed: ${reason}`);err("falling back to ArrayBuffer instantiation");}}return instantiateArrayBuffer(binaryFile,imports)}function getWasmImports(){return {a:wasmImports}}async function createWasm(){function receiveInstance(instance,module){wasmExports=instance.exports;wasmMemory=wasmExports["b"];updateMemoryViews();removeRunDependency();return wasmExports}addRunDependency();function receiveInstantiationResult(result){return receiveInstance(result["instance"])}var info=getWasmImports();if(Module["instantiateWasm"]){return new Promise((resolve,reject)=>{Module["instantiateWasm"](info,(mod,inst)=>{resolve(receiveInstance(mod));});})}wasmBinaryFile??=findWasmBinary();try{var result=await instantiateAsync(wasmBinary,wasmBinaryFile,info);var exports=receiveInstantiationResult(result);return exports}catch(e){readyPromiseReject(e);return Promise.reject(e)}}var callRuntimeCallbacks=callbacks=>{while(callbacks.length>0){callbacks.shift()(Module);}};var onPostRuns=[];var addOnPostRun=cb=>onPostRuns.push(cb);var onPreRuns=[];var addOnPreRun=cb=>onPreRuns.push(cb);var stackRestore=val=>__emscripten_stack_restore(val);var stackSave=()=>_emscripten_stack_get_current();var getHeapMax=()=>2147483648;var alignMemory=(size,alignment)=>Math.ceil(size/alignment)*alignment;var growMemory=size=>{var b=wasmMemory.buffer;var pages=(size-b.byteLength+65535)/65536|0;try{wasmMemory.grow(pages);updateMemoryViews();return 1}catch(e){}};var _emscripten_resize_heap=requestedSize=>{var oldSize=HEAPU8.length;requestedSize>>>=0;var maxHeapSize=getHeapMax();if(requestedSize>maxHeapSize){return false}for(var cutDown=1;cutDown<=4;cutDown*=2){var overGrownHeapSize=oldSize*(1+.2/cutDown);overGrownHeapSize=Math.min(overGrownHeapSize,requestedSize+100663296);var newSize=Math.min(maxHeapSize,alignMemory(Math.max(requestedSize,overGrownHeapSize),65536));var replacement=growMemory(newSize);if(replacement){return true}}return false};var getCFunc=ident=>{var func=Module["_"+ident];return func};var writeArrayToMemory=(array,buffer)=>{HEAP8.set(array,buffer);};var lengthBytesUTF8=str=>{var len=0;for(var i=0;i<str.length;++i){var c=str.charCodeAt(i);if(c<=127){len++;}else if(c<=2047){len+=2;}else if(c>=55296&&c<=57343){len+=4;++i;}else {len+=3;}}return len};var stringToUTF8Array=(str,heap,outIdx,maxBytesToWrite)=>{if(!(maxBytesToWrite>0))return 0;var startIdx=outIdx;var endIdx=outIdx+maxBytesToWrite-1;for(var i=0;i<str.length;++i){var u=str.charCodeAt(i);if(u>=55296&&u<=57343){var u1=str.charCodeAt(++i);u=65536+((u&1023)<<10)|u1&1023;}if(u<=127){if(outIdx>=endIdx)break;heap[outIdx++]=u;}else if(u<=2047){if(outIdx+1>=endIdx)break;heap[outIdx++]=192|u>>6;heap[outIdx++]=128|u&63;}else if(u<=65535){if(outIdx+2>=endIdx)break;heap[outIdx++]=224|u>>12;heap[outIdx++]=128|u>>6&63;heap[outIdx++]=128|u&63;}else {if(outIdx+3>=endIdx)break;heap[outIdx++]=240|u>>18;heap[outIdx++]=128|u>>12&63;heap[outIdx++]=128|u>>6&63;heap[outIdx++]=128|u&63;}}heap[outIdx]=0;return outIdx-startIdx};var stringToUTF8=(str,outPtr,maxBytesToWrite)=>stringToUTF8Array(str,HEAPU8,outPtr,maxBytesToWrite);var stackAlloc=sz=>__emscripten_stack_alloc(sz);var stringToUTF8OnStack=str=>{var size=lengthBytesUTF8(str)+1;var ret=stackAlloc(size);stringToUTF8(str,ret,size);return ret};var UTF8Decoder=typeof TextDecoder!="undefined"?new TextDecoder:undefined;var UTF8ArrayToString=(heapOrArray,idx=0,maxBytesToRead=NaN)=>{var endIdx=idx+maxBytesToRead;var endPtr=idx;while(heapOrArray[endPtr]&&!(endPtr>=endIdx))++endPtr;if(endPtr-idx>16&&heapOrArray.buffer&&UTF8Decoder){return UTF8Decoder.decode(heapOrArray.subarray(idx,endPtr))}var str="";while(idx<endPtr){var u0=heapOrArray[idx++];if(!(u0&128)){str+=String.fromCharCode(u0);continue}var u1=heapOrArray[idx++]&63;if((u0&224)==192){str+=String.fromCharCode((u0&31)<<6|u1);continue}var u2=heapOrArray[idx++]&63;if((u0&240)==224){u0=(u0&15)<<12|u1<<6|u2;}else {u0=(u0&7)<<18|u1<<12|u2<<6|heapOrArray[idx++]&63;}if(u0<65536){str+=String.fromCharCode(u0);}else {var ch=u0-65536;str+=String.fromCharCode(55296|ch>>10,56320|ch&1023);}}return str};var UTF8ToString=(ptr,maxBytesToRead)=>ptr?UTF8ArrayToString(HEAPU8,ptr,maxBytesToRead):"";var ccall=(ident,returnType,argTypes,args,opts)=>{var toC={string:str=>{var ret=0;if(str!==null&&str!==undefined&&str!==0){ret=stringToUTF8OnStack(str);}return ret},array:arr=>{var ret=stackAlloc(arr.length);writeArrayToMemory(arr,ret);return ret}};function convertReturnValue(ret){if(returnType==="string"){return UTF8ToString(ret)}if(returnType==="boolean")return Boolean(ret);return ret}var func=getCFunc(ident);var cArgs=[];var stack=0;if(args){for(var i=0;i<args.length;i++){var converter=toC[argTypes[i]];if(converter){if(stack===0)stack=stackSave();cArgs[i]=converter(args[i]);}else {cArgs[i]=args[i];}}}var ret=func(...cArgs);function onDone(ret){if(stack!==0)stackRestore(stack);return convertReturnValue(ret)}ret=onDone(ret);return ret};var cwrap=(ident,returnType,argTypes,opts)=>{var numericArgs=!argTypes||argTypes.every(type=>type==="number"||type==="boolean");var numericRet=returnType!=="string";if(numericRet&&numericArgs&&!opts){return getCFunc(ident)}return (...args)=>ccall(ident,returnType,argTypes,args)};{if(Module["noExitRuntime"])Module["noExitRuntime"];if(Module["print"])Module["print"];if(Module["printErr"])err=Module["printErr"];if(Module["wasmBinary"])wasmBinary=Module["wasmBinary"];if(Module["arguments"])Module["arguments"];if(Module["thisProgram"])Module["thisProgram"];}Module["cwrap"]=cwrap;var wasmImports={a:_emscripten_resize_heap};var wasmExports=await createWasm();wasmExports["c"];Module["_webp_encode_rgba"]=wasmExports["d"];Module["_webp_encode_lossless_rgba"]=wasmExports["e"];Module["_webp_decode_rgba"]=wasmExports["f"];Module["_webp_free"]=wasmExports["g"];Module["_malloc"]=wasmExports["h"];Module["_free"]=wasmExports["i"];var __emscripten_stack_restore=wasmExports["j"];var __emscripten_stack_alloc=wasmExports["k"];var _emscripten_stack_get_current=wasmExports["l"];function run(){if(runDependencies>0){dependenciesFulfilled=run;return}preRun();if(runDependencies>0){dependenciesFulfilled=run;return}function doRun(){Module["calledRun"]=true;if(ABORT)return;initRuntime();readyPromiseResolve(Module);Module["onRuntimeInitialized"]?.();postRun();}if(Module["setStatus"]){Module["setStatus"]("Running...");setTimeout(()=>{setTimeout(()=>Module["setStatus"](""),1);doRun();},1);}else {doRun();}}function preInit(){if(Module["preInit"]){if(typeof Module["preInit"]=="function")Module["preInit"]=[Module["preInit"]];while(Module["preInit"].length>0){Module["preInit"].shift()();}}}preInit();run();moduleRtn=readyPromise;


  return moduleRtn;
}
);
})();

class WebPCodec {
    /**
     * URL to the webp.wasm file. Set this before any SOG read/write operations
     * in browser environments where the default path resolution doesn't work.
     * Must be set before the first `create()` call: the compiled module is
     * cached, so later changes have no effect.
     *
     * @example
     * import { WebPCodec } from '@playcanvas/splat-transform';
     * import wasmUrl from '@playcanvas/splat-transform/lib/webp.wasm?url';
     * WebPCodec.wasmUrl = wasmUrl;
     */
    static wasmUrl = null;
    static modulePromise = null;
    Module;
    /**
     * The effective webp.wasm location to hand to worker threads (which can't
     * resolve it from their own module URL). Returns `wasmUrl` verbatim when
     * set - exactly the value `locateFile` uses, so a Windows file path or a
     * URL both pass through unchanged - otherwise the default resolution
     * relative to this module.
     *
     * @returns The configured `wasmUrl`, or the default webp.wasm URL.
     * @ignore
     */
    static resolveWasmUrl() {
        return WebPCodec.wasmUrl ?? new URL('../lib/webp.wasm', import.meta.url).toString();
    }
    static async create() {
        // Compile/instantiate the wasm module once and share it across all
        // instances; per-call instantiation pays a fresh Emscripten heap each
        // time (readers like readLcc2 call create() once per chunk). Memoize
        // the promise so concurrent first calls share a single instantiation,
        // but reset on rejection so a failed load (e.g. wasmUrl set late in a
        // browser) can be retried.
        if (!WebPCodec.modulePromise) {
            const promise = Module({
                locateFile: (path) => {
                    if (path.endsWith('.wasm') && WebPCodec.wasmUrl) {
                        return WebPCodec.wasmUrl;
                    }
                    return new URL(`../lib/${path}`, import.meta.url).toString();
                }
            });
            promise.catch(() => {
                if (WebPCodec.modulePromise === promise) {
                    WebPCodec.modulePromise = null;
                }
            });
            WebPCodec.modulePromise = promise;
        }
        const instance = new WebPCodec();
        instance.Module = await WebPCodec.modulePromise;
        return instance;
    }
    encodeLosslessRGBA(rgba, width, height, stride = width * 4) {
        const { Module } = this;
        const inPtr = Module._malloc(rgba.length);
        const outPtrPtr = Module._malloc(4);
        const outSizePtr = Module._malloc(4);
        Module.HEAPU8.set(rgba, inPtr);
        const ok = Module._webp_encode_lossless_rgba(inPtr, width, height, stride, outPtrPtr, outSizePtr);
        if (!ok) {
            throw new Error('WebP lossless encode failed');
        }
        const outPtr = Module.HEAPU32[outPtrPtr >> 2];
        const outSize = Module.HEAPU32[outSizePtr >> 2];
        const bytes = Module.HEAPU8.slice(outPtr, outPtr + outSize);
        Module._webp_free(outPtr);
        Module._free(inPtr);
        Module._free(outPtrPtr);
        Module._free(outSizePtr);
        return bytes;
    }
    decodeRGBA(webp) {
        const { Module } = this;
        const input = webp;
        const inPtr = Module._malloc(input.length);
        const outPtrPtr = Module._malloc(4);
        const widthPtr = Module._malloc(4);
        const heightPtr = Module._malloc(4);
        Module.HEAPU8.set(input, inPtr);
        const ok = Module._webp_decode_rgba(inPtr, input.length, outPtrPtr, widthPtr, heightPtr);
        if (!ok) {
            Module._free(inPtr);
            Module._free(outPtrPtr);
            Module._free(widthPtr);
            Module._free(heightPtr);
            throw new Error('WebP decode failed');
        }
        const outPtr = Module.HEAPU32[outPtrPtr >> 2];
        const width = Module.HEAPU32[widthPtr >> 2];
        const height = Module.HEAPU32[heightPtr >> 2];
        const size = width * height * 4;
        const bytes = Module.HEAPU8.slice(outPtr, outPtr + size);
        Module._webp_free(outPtr);
        Module._free(inPtr);
        Module._free(outPtrPtr);
        Module._free(widthPtr);
        Module._free(heightPtr);
        return { rgba: bytes, width, height };
    }
}

const taskHandlers = {
    quantize1d: (args) => {
        const result = quantize1dColumns(args.columns, args.k, args.alpha);
        return {
            result,
            transfer: [result.centroids.buffer, ...result.labels.map(c => c.data.buffer)]
        };
    },
    encodeWebp: async (args) => {
        // create() memoizes the wasm module per realm (each worker compiles
        // its own copy on first use)
        const codec = await WebPCodec.create();
        const webp = codec.encodeLosslessRGBA(args.rgba, args.width, args.height);
        return { result: webp, transfer: [webp.buffer] };
    }
};

/**
 * Worker-side entry point, built and shipped as `dist/worker.mjs` (see
 * rollup.config.mjs) and spawned by WorkerQueue from a URL. Runs one task at a
 * time and posts the result back with its buffers transferred.
 */
const bind = (post, listen) => {
    listen(async (message) => {
        if (message.type === 'init') {
            // resolved host-side and handed in, so the worker uses the same
            // wasm location as the host regardless of its own module URL
            WebPCodec.wasmUrl = message.wasmUrl;
            return;
        }
        try {
            const { result, transfer } = await taskHandlers[message.task](message.args);
            post({ type: 'result', result }, transfer);
        }
        catch (err) {
            post({
                type: 'error',
                message: err instanceof Error ? err.message : String(err),
                stack: err instanceof Error ? err.stack : undefined
            }, []);
        }
    });
    // unprompted readiness signal: lets the host distinguish "environment
    // cannot run workers" (no ready, fall back inline) from a task crashing
    // a live worker
    post({ type: 'ready' }, []);
};
// same guard as WorkerQueue's isNode: a real worker_threads worker, not an
// Electron renderer (where process.versions.node is present but messaging goes
// through the Web Worker scope)
if (typeof process !== 'undefined' && !!process.versions?.node && process.type !== 'renderer') {
    // node MessagePorts buffer messages until a listener attaches, so the
    // host's init message survives this async import
    import('node:worker_threads').then(({ parentPort }) => {
        bind((message, transfer) => parentPort.postMessage(message, transfer), handler => parentPort.on('message', handler));
    });
}
else {
    // tsconfig lib "dom" types postMessage/onmessage as Window's; cast to the
    // dedicated worker scope shape
    const scope = globalThis;
    bind((message, transfer) => scope.postMessage(message, transfer), (handler) => {
        scope.onmessage = (event) => handler(event.data);
    });
}
//# sourceMappingURL=worker.mjs.map
