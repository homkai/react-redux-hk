/**
 * Created by Homkai on 16/12/12.
 */
import React from 'react';
import {connect as rrConnect, Provider} from 'react-redux';
import shallowEqual from 'react-redux/lib/utils/shallowEqual';

const PATH_SEP = '//';
const DEP_STATE_DEPTH = 2;
const DEP_OWN_PROPS_DEPTH = 1;

const __depCache__ = {};
const __trueState__ = {};

function connect(mapStateToProps, mapDispatchToProps, mergeProps, options) {
    // pureMapState true表示mapStateToProps只依赖state false表示不做优化
    let {pureMapState = 'to test', depStateDepth = DEP_STATE_DEPTH} = options || {};
    const uid = mapStateToProps.toString() + PATH_SEP + Math.random();
    return Component => {
        const mapDepState = !mapStateToProps
            ? undefined
            : (state, ownProps) => {
                if (!pureMapState) {
                    return mapStateToProps(state, ownProps);
                }
                let depState = null;
                // 如果是pureMapState则优先读缓存，避免重复分析depState
                if (getDepStateCache(uid)) {
                    depState = {};
                    Object.keys(getDepStateCache(uid)).forEach(path => (depState[path] = getValueByPath(state, path)));
                    // 如果新的depState有更新（shallowEqual不一致），则重新分析依赖
                    if (updateDepStateCache(uid, depState)) {
                        depState = null;
                    }
                }
                if (!depState) {
                    const testOwnProps = pureMapState === true ? {} : ownProps;
                    const result = analyzeDepState(uid, state, testOwnProps, mapStateToProps, depStateDepth);
                    depState = result.depState;
                    pureMapState = result.cacheable;
                    __trueState__[uid] = result.stateProps;
                }
                const props = {...depState};
                props.__trueState__ = __trueState__[uid];
                const tempList = [...Object.keys(props), '__tempList__'];
                return {
                    ...props,
                    __tempList__: tempList.join(',')
                };
            };
        return rrConnect(
            mapDepState,
            mapDispatchToProps,
            mergeProps,
            options
        )(buildGuardComponent(Component));
    };
}

// 就相当于给component一个门卫一样
// 如果depState没变，门卫不会重新计算mapStateToProps，也不会通知component重新渲染
function buildGuardComponent(Component) {
    return props => {
        let stateAndCallbacks = props;
        if (props.__trueState__) {
            const validProps = {...props};
            const tempList = props.__tempList__.split(',');
            Object.keys(validProps).forEach(key => (tempList.indexOf(key) > -1 && delete validProps[key]));
            stateAndCallbacks = {
                ...validProps,
                ...props.__trueState__
            };
        }
        return <Component {...stateAndCallbacks} />
    };
}

// 分析mapStateToProps真正依赖到的状态 depState
function analyzeDepState(uid, state, ownProps, mapState, depStateDepth) {
    const stateUid = uid + PATH_SEP + 'state';
    const ownPropsUid = uid + PATH_SEP + 'ownProps';
    const {cacheDep: cacheDepState, dep: depState} = buildCacheDep(stateUid);
    const stateProxy = proxyObj(state, cacheDepState, depStateDepth);
    const {cacheDep: cacheDepProps, dep: depProps} = buildCacheDep(ownPropsUid);
    const propsProxy = proxyObj(ownProps, cacheDepProps, DEP_OWN_PROPS_DEPTH);
    const stateProps = mapState(stateProxy, propsProxy);

    const ret = {stateProps};

    // 判断是否依赖ownProps，如果依赖，则不缓存
    ret.cacheable = !Object.keys(depProps).length;
    removeDepCache(ownPropsUid);

    // 过滤依赖obj.key而不依赖obj的depState
    const depObjStatePathList = Object.keys(depState)
        .filter(item => item.split(PATH_SEP).length <= depStateDepth && typeof depState[item] === 'object');
    if (depObjStatePathList.length) {
        const depObjStateRefList = depObjStatePathList.map(item => depState[item]);
        removeObjStateDep(depObjStateRefList, stateProps);
        Object.keys(depState).forEach(key => {
            if (depObjStateRefList.indexOf(depState[key]) > -1) {
                delete depState[key];
            }
        });
    }
    ret.depState = depState;

    return ret;
}

// 当依赖了具体的obj.key时，移除实际不需要的对整个obj的依赖
function removeObjStateDep(depObjStateRefList, stateProps) {
    if (depObjStateRefList.indexOf(stateProps) > -1) {
        depObjStateRefList.splice(depObjStateRefList.indexOf(stateProps), 1);
        if (!depObjStateRefList.length) {
            return;
        }
    }
    if (stateProps && typeof stateProps === 'object') {
        const statePropsKeyList = Object.keys(stateProps);
        for (let i = 0; i < statePropsKeyList.length; i++) {
            const value = stateProps[statePropsKeyList[i]];
            value && typeof value === 'object' && removeObjStateDep(depObjStateRefList, value);
        }
    }
}

function buildCacheDep(uid) {
    __depCache__[uid] = __depCache__[uid] || {};
    const dep = __depCache__[uid];
    return {
        cacheDep: (path, value) => {dep[path] = value},
        dep
    };
}

function getDepStateCache(uid) {
    return __depCache__[uid + PATH_SEP + 'state'];
}

function updateDepStateCache(uid, depState) {
    if (shallowEqual(__depCache__[uid + PATH_SEP + 'state'], depState)) {
        return false;
    }
    __depCache__[uid + PATH_SEP + 'state'] = {...depState};
    return true;
}

function removeDepCache(uid) {
    delete __depCache__[uid];
}

function proxyObj(obj, cb, depth = 100, keyPath = PATH_SEP) {
    const objProxy = keyPath === PATH_SEP ? {} : obj;
    Object.keys(obj).forEach(key => {
        const path = keyPath + key;
        let value = obj[key];
        if (typeof value === 'object' && value && depth > 1) {
            value = Array.isArray(obj[key]) ? [...obj[key]] : {...obj[key]};
            proxyObj(value, cb, depth - 1, path + PATH_SEP);
        }
        Object.defineProperty(objProxy, key, {
            get() {
                cb(path, value);
                return value;
            }
        });
    });
    return objProxy;
}

function getValueByPath(obj, path) {
    const keyList = path.split(PATH_SEP);
    let ret = obj;
    for (let i = 0; i < keyList.length; i++) {
        if (!keyList[i]) {
            continue;
        }
        ret = ret[keyList[i]];
    }
    return ret;
}


export {
    Provider,
    connect
};
