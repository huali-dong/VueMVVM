function Vue(options = {}) {
  this.$options = options; // 将options属性的数据都挂载再$options
  var data = this._data = this.$options.data;

  console.log(this.$options, 'init1');

  observe(data)
  // this 代理 _data
  for (let key in data) {
    Object.defineProperty(this, key, {
      enumerable: true,
      get() {
        return this._data[key]; // this.a == {a: 1}
      },
      set(newVal) {
        this._data[key] = newVal;
      }
    })
  }
  initComputed.call(this);
  new Compiler(options.el, this); // 编译模板
}


function initComputed() {
  let vm = this;
  let computed = this.$options.computed;
  Object.keys(computed).forEach(function (key) {
    Object.defineProperty(vm, key, { // 映射到this实例上
      get: typeof computed[key] === 'function' ? computed[key] : computed[key].get,
      set() {

      }
    })
  })
}

// 观察对象给对象添加Object.defaineProperty
function Observe(data) { // 这里面写我们的主要逻辑
  let dep = new Dep()
  for (let key in data) {
    let val = data[key];
    observe(val)
    // 把data属性通过Object.defaineProperty方式定义属性
    console.log(data, 'data');
    Object.defineProperty(data, key, {
      enumerable: true,
      get() {
        Dep.target && dep.addSub(Dep.target) // 添加watch 到 sub 数组
        return val;
      },
      set(newVal) { // 更改值的时候
        if (newVal === val) { // 设的值和以前一样的话, 不做任何处理
          return;
        }
        val = newVal; // 如果以后再获取值的时候将刚才设置的值丢回去
        observe(newVal); // 作用就是当我们赋值一个{a:2}也想被劫持
        dep.notify() // 当有数据需要更新时会执行到这里，然后会执行到Dep.subs中watcher实列里的update方法，并且会执行Watcher中的回调函数
      }
    })
  }
}

function Compiler(el, vm) {
  // el 替换的范围
  vm.$el = document.querySelector(el);
  console.log(vm.$el, 'el');
  let fragment = document.createDocumentFragment() //文档碎片： 不属于Dom树，但是可以存储DOM,并且可以将存储的DOM加入到指定的DOM节点中，主要是用他是因为比直接操作DOM性能快
  while (child = vm.$el.firstChild) { // 将app中的内容移入到内存中
    fragment.appendChild(child)
  }
  replace(fragment)

  function replace(fragment) {
    Array.from(fragment.childNodes).forEach(function (node) { // 循环每一层
      let text = node.textContent;
      let reg = /\{\{(.*)\}\}/;
      // 3文本节点
      if (node.nodeType === 3 && reg.test(text)) {
        // console.log(RegExp.$1); // a.a b
        let arr = RegExp.$1.split('.'); // [a, a]
        let val = vm;
        arr.forEach(function (k) { // 取this.a.a this.b
          val = val[k]
        })

        //实列化一个watcher,并且会将这个watcher实列添加到Dep实列中
        new Watcher(vm, RegExp.$1, function (newVal) { // 函数里需要接收一个新的值
          node.textContent = text.replace(reg, newVal)
        })
        // 替换逻辑
        node.textContent = text.replace(reg, val)
      }
      if (node.nodeType === 1) {
        // 1元素节点
        let nodeAttrs = node.attributes; //获取当前dom接待你的属性
        Array.from(nodeAttrs).forEach(function (attr) {
          // console.log(attr)
          let name = attr.name // type='text'
          let exp = attr.value // v-model = 'b
          // let [name, exp] = attr;
          // console.log(name)
          // console.log(exp)
          if (name.includes('v-')) {
            node.value = vm[exp]
          }
          new Watcher(vm, exp, function (newVal) {
            node.value = newVal; // 当watcher触发时会自动将内容放到输入框内
          })
          node.addEventListener('input', function (e) {
            let newVal = e.target.value;
            vm[exp] = newVal;
          })
        })
      }
      // 如果当前节点还有孩子节点的话
      if (node.childNodes) {
        replace(node)
      }
    })
  }

  vm.$el.appendChild(fragment) // 将内存中的内容塞回app中
}

function observe(data) {
  if (typeof data !== 'object') return; // 防止内存溢出
  return new Observe(data)
}
// vue特点不能新增或者删除不存在的属性， 不存在的属性没有get和set

// 发布订阅
function Dep() {
  this.subs = []
}

//订阅
Dep.prototype.addSub = function (sub) {
  this.subs.push(sub)
}

Dep.prototype.notify = function () {
  this.subs.forEach(sub => sub.update())
}

/**
 * watcher
 * @param {*} vm 当前实例
 * @param {*} exp 表达式
 * @param {*} fn 监听函数
 */
function Watcher(vm, exp, fn) {
  this.fn = fn;
  this.vm = vm;
  this.exp = exp; // 添加到订阅中
  Dep.target = this;
  let val = vm;
  let arr = exp.split('.');
  arr.forEach(function (k) { // this.a.a 取值默认会调用get方法
    val = val[k];
  })
  Dep.target = null;
}

Watcher.prototype.update = function () {
  let val = this.vm;
  let arr = this.exp.split('.');
  arr.forEach(function (k) {
    val = val[k];
  })
  this.fn(val) // 将新值传递给回调函数进行替换
}




//  总结
// Observer/Compiler/Watcher
//发布订阅模式 
//Dep 
//1、 使用Object.defineProperty劫持所有对象,在get的时候调用Dep.subs，将watcher的实列加入到订阅中
//2、 在set的时候，调用Dep.notify，会执行所有的watcher实列的update方法， 主要是在Oberser中
//3、 在New出来的实列执行Compile的时候，会检测元素节点是文本还是元素节点为1的类型，v- {{}}， 然后new Watcher，在watcher中会将自己添加到subs，如果有变化，会更新node 节点里的数据