/**
 * Created by Homkai on 16/12/12.
 */
import React from 'react';
import {connect as rrConnect, Provider} from 'react-redux';
import omit from 'lodash/omit';

const __depState__ = {};
const __trueState__ = [];

function connect(mapStateToProps, mapDispatchToProps, mergeProps = undefined, options = {}) {
    // 依赖的state是否pure——每次mapStateToProps执行依赖的state是否一样
    const {pureDepState = true} = options;
    return Component => {
        const mapDepState = !mapStateToProps ? undefined : (store, ownProps) => {
            const uid = mapStateToProps.toString();
            const {depState, storeProxy} = getDepStateAndStoreProxy(uid, store, pureDepState);
            __trueState__[0] = storeProxy
                // 初次connect时，执行
                ? mapStateToProps(storeProxy, ownProps)
                : mapStateToProps.bind(null, store, ownProps);
            const props = depState;
            props.__trueState__ = __trueState__;
            const tempList = [...Object.keys(props), '__tempList__'];
            return {
                ...props,
                __tempList__: tempList.join(',')
            };
        };
        Component = getGuardComponent(Component);
        return rrConnect(
            mapDepState,
            mapDispatchToProps,
            mergeProps,
            options
        )(Component);
    };
}

function getGuardComponent(Component) {
    return props => {
        let trueState = props.__trueState__[0];
        // 把mapStateToProps的计算逻辑放到GuardComponent渲染时执行，减少不必要的性能损耗
        trueState = typeof trueState === 'function' ? trueState() : trueState;
        const stateAndCallbacks = {
            ...omit(props, props.__tempList__.split(',')),
            ...trueState
        };
        return <Component {...stateAndCallbacks} />
    };
}

function getDepStateAndStoreProxy(uid, store, pureDepState) {
    // 如果是pureDepState，则只分析一次依赖的state，再次执行直接返回新的depState
    if (pureDepState && __depState__[uid]) {
        const depState = __depState__[uid];
        Object.keys(depState).forEach(path => (depState[path] = getStateByPath(store, path)));
        return {depState};
    }
    __depState__[uid] = __depState__[uid] || {};
    const depState = __depState__[uid];
    const storeProxy = {};
    Object.keys(store).forEach(namespace => {
        Object.defineProperty(storeProxy, namespace, {
            get() {
                const obj = {...store[namespace]};
                Object.keys(store[namespace]).forEach(key => {
                    Object.defineProperty(obj, key, {
                        get() {
                            const value = store[namespace][key];
                            depState[namespace + '/' + key] = value;
                            // 判断是否依赖整个model的state
                            if (depState[namespace]) {
                                const keyList = Object.keys(depState).filter(key => !key.indexOf(namespace + '/'));
                                if (keyList.length === Object.keys(depState[namespace]).length) {
                                    delete depState[namespace];
                                }
                            }
                            return value;
                        }
                    });
                });
                depState[namespace] = store[namespace];
                return obj;
            }
        });
    });
    return {
        depState,
        storeProxy
    };
}

function getStateByPath(state, path) {
    const [namespace, field] = path.split('/');
    return field ? state[namespace][field] : state[namespace];
}


export {
    Provider,
    connect
};
