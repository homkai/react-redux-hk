# react-redux-hk
自动分析connect依赖的state，当且仅当mapStateToProps依赖的state改变时，才会重新计算mapStateToProps，进而触发重新渲染Component

完全兼容react-redux的api，可直接替代

# 解决什么问题
如下代码：
```js
const state = {
    listData: [],
    planId: 0,
    unitId: 0,
    showEditor: false
};

function getCrumbInfo(state) {
    const plan = state.listData.filter(item => item.id === state.planId)[0];
    const unit = plan.unitList.filter(item => item.id === state.unitId)[0];
    return {
        planName: plan.planName,
        unitName: unit.unitName
    };
}

function mapStateToProps(state) {
    return {
        planList: state.listData,
        crumbInfo: getCrumbInfo(state)
    };
}
```
mapStateToProps返回的crumbInfo，即使实际依赖的listData、planId、unitId没有变（如只有showEditor改变时），
getCrumbInfo每次执行return的引用都是不同的，这会导致react-redux的shallowEqual不一致，
进而会重新渲染connect的Component

业务代码中，这样的例子很常见，导致某一局部状态更新，牵一发而动全身，很多地方不需要重新渲染的，也重新渲染，大大降低页面性能

# 常见的方案
- Immutable.js 引入这个库的成本很高，需要很多地方都改成Immutable.js的API
- reselect 使用这个库也比较麻烦，因为需要显式地用function声明很多状态的依赖，导致mapStateToProps很复杂

# react-redux-hk的思路
自动分析mapStateToProps依赖的state，只有当依赖的state改变时，才会重新计算mapStateToProps，进而触发重新渲染Component

**不需要额外处理，即可自动完成性能优化**