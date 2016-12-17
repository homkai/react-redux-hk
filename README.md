# react-redux-hk
自动分析connect依赖的state，当且仅当mapStateToProps依赖的state改变时，才会重新计算mapStateToProps，进而触发重新渲染Component

完全兼容react-redux的api，可直接替代

# 解决什么问题
如下代码：
```js
// 假定state定义如下
const state = {
    listData: [],
    planId: 0,
    unitId: 0,
    showEditor: false
};


function getInfo(state) {
    return {
        planId: state.planId,
        unitId: state.unitId
    };
}
function mapStateToProps(state) {
    return {
        planList: state.listData.filter(item => (item.unitList.length > 0)),
        info: getInfo(state)
    };
}
```
每次执行mapStateToProps返回的planList、info永远都是一个新的引用。
当showEditor改变，而mapStateToProps实际依赖的listData、planId、unitId没有变时，
mapStateToProps仍然会重新执行，connect的Component也会重新渲染，而这些是不必要的性能损耗。

原理是mapStateToProps的返回值的某一项，值没有改，但是引用改了，导致react-redux的shallowEqual不一致，
进而会重新渲染connect的Component

业务代码中，这样的例子很常见，某一局部状态更新，牵一发而动全身，很多地方不需要重新渲染的，也重新渲染，大大降低页面性能

# 常见的方案
- Immutable.js 引入这个库的成本很高，需要很多地方都改成Immutable.js的API
- reselect 使用这个库也比较麻烦，因为需要显式地用function声明很多状态的依赖，导致mapStateToProps很复杂

# react-redux-hk的思路
自动分析mapStateToProps依赖的state，只有当依赖的state改变时，才会重新计算mapStateToProps，进而触发重新渲染Component

## 注意
使用react-redux-hk替换react-redux时，要保证mapStateToProps是只依赖state和ownProps这两个变量的纯函数（可以依赖外部的常量）

如果mapStateToProps依赖其他变量（这是违反redux原则的，极力反对这样的代码），可以通过传第四个参数options.pureMapState = false来兼容

## 高级用法

react-redux-hk默认对redux的状态，分析两层（第一层reducer或model，第二层定义的状态字段），这是符合redux状态定义原则的，一般无需修改

如果状态的定义有过多的plain object（把一些子状态放到一同个状态对象下面，当然，一般是不推荐这种写法的）
可以通过传第四个参数options.depStateDepth = 3来调整分析依赖的深度，如果这个值设置得适当大一些，那么可能会找到mobX的影子

**不需要额外处理，即可自动完成性能优化**