"""Keep long jobs (view building, training) from hogging the PC."""

import os
import sys


def low_priority():
    """Run the current process at below-normal CPU priority. Safe to call anywhere."""
    try:
        if sys.platform == 'win32':
            import ctypes
            from ctypes import wintypes
            below_normal = 0x4000
            kernel32 = ctypes.windll.kernel32
            # declare the handle type: ctypes' default int return truncates the 64-bit handle
            kernel32.GetCurrentProcess.restype = wintypes.HANDLE
            kernel32.SetPriorityClass.argtypes = (wintypes.HANDLE, wintypes.DWORD)
            kernel32.SetPriorityClass(kernel32.GetCurrentProcess(), below_normal)
        else:
            os.nice(10)
    except Exception:
        pass


def limit_tf_threads(n=None):
    """Cap TensorFlow's CPU threads (default: leave a third of the cores free).

    Must run before TensorFlow executes anything; returns the thread count used.
    """
    n = n or max(1, (os.cpu_count() or 3) * 2 // 3)
    import tensorflow as tf
    try:
        tf.config.threading.set_intra_op_parallelism_threads(n)
        tf.config.threading.set_inter_op_parallelism_threads(2)
    except RuntimeError:
        pass   # TensorFlow already initialised; keep its settings
    return n
