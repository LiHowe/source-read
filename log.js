let step = 0
export function h_log({
    stage,
    msg,
    objs
}) {
    console.log(`%c vue - ${stage}`, 'background: #4caf50;color: #fff;', msg, objs)
}

async function h_pause() {
    return new Promise((resolve, reject) => {
        while(step % 2) {
            resolve()
        }
    })
}

function h_resume() {
    step++
}