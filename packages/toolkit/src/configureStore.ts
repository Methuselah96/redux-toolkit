import type {
  Reducer,
  ReducersMapObject,
  Middleware,
  Action,
  AnyAction,
  StoreEnhancer,
  Store,
  Dispatch,
  StateFromReducersMapObject,
  ActionFromReducersMapObject,
  PreloadedStateFromReducersMapObject,
} from 'redux'
import { createStore, compose, applyMiddleware, combineReducers } from 'redux'
import type { DevToolsEnhancerOptions as DevToolsOptions } from './devtoolsExtension'
import { composeWithDevTools } from './devtoolsExtension'

import isPlainObject from './isPlainObject'
import type {
  ThunkMiddlewareFor,
  CurriedGetDefaultMiddleware,
} from './getDefaultMiddleware'
import { curryGetDefaultMiddleware } from './getDefaultMiddleware'
import type {
  ExtractDispatchExtensions,
  ExtractStoreExtensions,
  NoInfer,
} from './tsHelpers'

const IS_PRODUCTION = process.env.NODE_ENV === 'production'

/**
 * Callback function type, to be used in `ConfigureStoreOptions.enhancers`
 *
 * @public
 */
export type ConfigureEnhancersCallback<E extends Enhancers = Enhancers> = (
  defaultEnhancers: readonly StoreEnhancer[]
) => [...E]

export type InferStateFromReducer<
  R extends Reducer<any, any, any> | ReducersMapObject<any, any, any>
> = R extends Reducer<infer S, any, any>
  ? S
  : R extends ReducersMapObject<any, any, any>
  ? StateFromReducersMapObject<R>
  : never

export type InferActionFromReducer<
  R extends Reducer<any, any, any> | ReducersMapObject<any, any, any>
> = R extends Reducer<any, infer A, any>
  ? A
  : R extends ReducersMapObject<any, any, any>
  ? ActionFromReducersMapObject<R>
  : never

export type InferPreloadedStateFromReducer<
  R extends Reducer<any, any, any> | ReducersMapObject<any, any, any>
> = R extends Reducer<any, any, infer PreloadedState>
  ? PreloadedState
  : R extends ReducersMapObject<any, any, any>
  ? Partial<PreloadedStateFromReducersMapObject<R>>
  : never

export type InferReducerFromReducerProperty<
  R extends Reducer<any, any, any> | ReducersMapObject<any, any, any>
> = R extends Reducer<any, any, any>
  ? R
  : R extends ReducersMapObject<any, any, infer PreloadedState>
  ? Reducer<
      StateFromReducersMapObject<R>,
      ActionFromReducersMapObject<R>,
      Partial<PreloadedStateFromReducersMapObject<R>>
    >
  : never

/**
 * Options for `configureStore()`.
 *
 * @public
 */
export interface ConfigureStoreOptions<
  R extends Reducer<any, any, any> | ReducersMapObject<any, any, any>,
  M extends Middlewares<InferStateFromReducer<R>> = Middlewares<
    InferStateFromReducer<R>
  >,
  E extends Enhancers = Enhancers
> {
  /**
   * A single reducer function that will be used as the root reducer, or an
   * object of slice reducers that will be passed to `combineReducers()`.
   */
  reducer: R

  /**
   * An array of Redux middleware to install. If not supplied, defaults to
   * the set of middleware returned by `getDefaultMiddleware()`.
   *
   * @example `middleware: (gDM) => gDM().concat(logger, apiMiddleware, yourCustomMiddleware)`
   * @see https://redux-toolkit.js.org/api/getDefaultMiddleware#intended-usage
   */
  middleware?:
    | ((
        getDefaultMiddleware: CurriedGetDefaultMiddleware<
          InferStateFromReducer<R>
        >
      ) => M)
    | M

  /**
   * Whether to enable Redux DevTools integration. Defaults to `true`.
   *
   * Additional configuration can be done by passing Redux DevTools options
   */
  devTools?: boolean | DevToolsOptions

  /**
   * The initial state, same as Redux's createStore.
   * You may optionally specify it to hydrate the state
   * from the server in universal apps, or to restore a previously serialized
   * user session. If you use `combineReducers()` to produce the root reducer
   * function (either directly or indirectly by passing an object as `reducer`),
   * this must be an object with the same shape as the reducer map keys.
   */
  /*
  Not 100% correct but the best approximation we can get:
  - if S is a `CombinedState` applying a second `CombinedState` on it does not change anything.
  - if it is not, there could be two cases:
    - `ReducersMapObject<S, A>` is being passed in. In this case, we will call `combineReducers` on it and `CombinedState<S>` is correct
    - `Reducer<S, A>` is being passed in. In this case, actually `CombinedState<S>` is wrong and `S` would be correct.
    As we cannot distinguish between those two cases without adding another generic parameter,
    we just make the pragmatic assumption that the latter almost never happens.
  */
  preloadedState?: InferPreloadedStateFromReducer<R> | undefined

  /**
   * The store enhancers to apply. See Redux's `createStore()`.
   * All enhancers will be included before the DevTools Extension enhancer.
   * If you need to customize the order of enhancers, supply a callback
   * function that will receive the original array (ie, `[applyMiddleware]`),
   * and should return a new array (such as `[applyMiddleware, offline]`).
   * If you only need to add middleware, you can use the `middleware` parameter instead.
   */
  enhancers?: E | ConfigureEnhancersCallback<E>
}

type Middlewares<S> = ReadonlyArray<Middleware<{}, S>>

type Enhancers = ReadonlyArray<StoreEnhancer>

export interface ToolkitStore<
  R extends Reducer<any, any, any> | ReducersMapObject<any, any, any>,
  M extends Middlewares<InferStateFromReducer<R>> = Middlewares<
    InferStateFromReducer<R>
  >
> extends Store<InferStateFromReducer<R>, InferActionFromReducer<R>> {
  /**
   * The `dispatch` method of your store, enhanced by all its middlewares.
   *
   * @inheritdoc
   */
  dispatch: ExtractDispatchExtensions<M> & Dispatch<InferActionFromReducer<R>>
}

/**
 * A Redux store returned by `configureStore()`. Supports dispatching
 * side-effectful _thunks_ in addition to plain actions.
 *
 * @public
 */
export type EnhancedStore<
  R extends Reducer<any, any, any> | ReducersMapObject<any, any, any>,
  M extends Middlewares<InferStateFromReducer<R>> = Middlewares<
    InferStateFromReducer<R>
  >,
  E extends Enhancers = Enhancers
> = ToolkitStore<R, M> & ExtractStoreExtensions<E>

/**
 * A friendly abstraction over the standard Redux `createStore()` function.
 *
 * @param options The store configuration.
 * @returns A configured Redux store.
 *
 * @public
 */
export function configureStore<
  R extends Reducer<any, any, any> | ReducersMapObject<any, any, any>,
  M extends Middlewares<InferStateFromReducer<R>> = [
    ThunkMiddlewareFor<InferStateFromReducer<R>>
  ],
  E extends Enhancers = [StoreEnhancer]
>(options: ConfigureStoreOptions<R, M, E>): EnhancedStore<R, M, E> {
  const curriedGetDefaultMiddleware =
    curryGetDefaultMiddleware<InferStateFromReducer<R>>()

  const {
    reducer = undefined,
    middleware = curriedGetDefaultMiddleware(),
    devTools = true,
    preloadedState = undefined,
    enhancers = undefined,
  } = options || {}

  let rootReducer: InferReducerFromReducerProperty<R>

  if (typeof reducer === 'function') {
    rootReducer = reducer as InferReducerFromReducerProperty<R>
  } else if (isPlainObject(reducer)) {
    rootReducer = combineReducers(reducer) as InferReducerFromReducerProperty<R>
  } else {
    throw new Error(
      '"reducer" is a required argument, and must be a function or an object of functions that can be passed to combineReducers'
    )
  }

  let finalMiddleware = middleware
  if (typeof finalMiddleware === 'function') {
    finalMiddleware = finalMiddleware(curriedGetDefaultMiddleware)

    if (!IS_PRODUCTION && !Array.isArray(finalMiddleware)) {
      throw new Error(
        'when using a middleware builder function, an array of middleware must be returned'
      )
    }
  }
  if (
    !IS_PRODUCTION &&
    finalMiddleware.some((item: any) => typeof item !== 'function')
  ) {
    throw new Error(
      'each middleware provided to configureStore must be a function'
    )
  }

  const middlewareEnhancer: StoreEnhancer = applyMiddleware(...finalMiddleware)

  let finalCompose = compose

  if (devTools) {
    finalCompose = composeWithDevTools({
      // Enable capture of stack traces for dispatched Redux actions
      trace: !IS_PRODUCTION,
      ...(typeof devTools === 'object' && devTools),
    })
  }

  let storeEnhancers: Enhancers = [middlewareEnhancer]

  if (Array.isArray(enhancers)) {
    storeEnhancers = [middlewareEnhancer, ...enhancers]
  } else if (typeof enhancers === 'function') {
    storeEnhancers = enhancers(storeEnhancers)
  }

  const composedEnhancer = finalCompose(...storeEnhancers) as StoreEnhancer<any>

  return createStore(rootReducer, preloadedState, composedEnhancer)
}
